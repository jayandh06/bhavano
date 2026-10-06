import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import type { BoostPricingPreviewDto, ListingCategory } from "@bhavano/types";
import {
  boostOptionFor,
  boostSavings,
  defaultBoostDuration,
  offeredBoostDurations,
  type BoostDurationDays,
} from "@bhavano/types/boostPricing";
import { boostRecoveryMessage, type BoostEffectivenessDto } from "@bhavano/types/boostEffectiveness";
import { ACTIVE_PROMO_CODE, discountPercentFor } from "@bhavano/types/promoCode";
import type { PurchaseSource } from "@bhavano/types/purchaseSource";
import { useAppTheme } from "../../theme/ThemeContext";
import { previewBoostPricing } from "../../lib/bffClient";
import { startBoostCheckout } from "../../lib/boostCheckout";
import { Icon } from "../Icon";
import { ReferralFreeBoost } from "./ReferralFreeBoost";

// Temporary September promo — same constant as the website's own copy in
// app/actions/payments.ts. Auto-applied so the price shown is just what checkout will actually
// charge; the discount only takes effect if this code exists, is active, and hasn't expired in
// the admin discount-codes screen — nothing here grants it on its own. Exported so the iOS
// success-screen cards in PostAdWizard.tsx (which fetch pricing for display only, no in-app
// checkout) apply the same code rather than carrying a third copy of this string.


/**
 * Android-only inline Boost picker on the post-ad success screen. Fetches every duration's price up
 * front (PaymentsService.previewBoostPricing, which also resolves the current promo code and the
 * Agent Pro free-credit case) and shows what each longer option saves against the 7-day price.
 * Instant Alerts is included in every boost at no extra charge, so there is no separate choice.
 *
 * iOS keeps the old two-button, redirect-to-website treatment untouched — a native Razorpay
 * checkout for a paid feature is exactly what Apple's Guideline 3.1.1 forbids there, same
 * reasoning BoostModal/InstantAlertsModal already documented.
 */
export function BoostBundleCard({
  listingId,
  category,
  accessToken,
  onActivating,
  source,
  ignorePlacementSetting = false,
  effectiveness,
}: {
  listingId: string;
  category: ListingCategory;
  accessToken: string;
  /** Where this checkout was started from, recorded on the payment. */
  source?: PurchaseSource;
  /** The admin placement setting (below) only decides where the post-ad screen offers a boost;
   * a caller outside that flow (the admin Boost message) always shows the picker. */
  ignorePlacementSetting?: boolean;
  /** Payment succeeded (or a Pro credit activated it directly, no checkout needed) — the caller
   * swaps this card for its own "pending" state while the webhook confirms, same contract
   * BoostModal/InstantAlertsModal already use. */
  onActivating: () => void;
  /** The same real boosted-vs-unboosted stats the web review step already shows
   * (docs/plans/boost-offer-conversion-2026-09.md's own finding: the ~12x-views lift is the
   * strongest argument for boosting, and wasn't shown on this card before) — null before the
   * nightly job's first run, or while either cohort is still below MIN_SAMPLE_SIZE. */
  effectiveness?: BoostEffectivenessDto | null;
}) {
  const { colors } = useAppTheme();
  const [pricing, setPricing] = useState<BoostPricingPreviewDto | null>(null);
  // The middle option is pre-selected: a 7-day default was taken by 13 of 19 buyers, and the longer
  // options are cheaper per day.
  const [duration, setDuration] = useState<BoostDurationDays>(15);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    previewBoostPricing(accessToken, category, ACTIVE_PROMO_CODE, listingId)
      .then((result) => {
        if (!cancelled) setPricing(result);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [accessToken, category, listingId]);

  const offered = offeredBoostDurations(pricing);
  // A duration admin has switched off falls back to the default rather than staying selected.
  const effectiveDuration = offered.includes(duration) ? duration : defaultBoostDuration(offered);
  const option = pricing ? boostOptionFor(pricing, effectiveDuration) : undefined;

  async function onPay() {
    setPending(true);
    setError(null);
    const result = await startBoostCheckout({
      accessToken,
      listingId,
      duration: effectiveDuration,
      includeInstantAlerts: true,
      discountCode: ACTIVE_PROMO_CODE,
      source,
    });
    setPending(false);
    if (result.outcome === "activated" || result.outcome === "paid") onActivating();
    else if (result.outcome === "error") setError(result.message);
    // "cancelled" — same as before, no error shown, just re-enable the button.
  }

  // Was a single string with a "→" (U+2192) glyph between old and new price — reported on
  // Android as rendering as a stray "'n" instead of an arrow, almost certainly this app's custom
  // fonts (Lora/Manrope) having no glyph for that character and Android's fallback substitution
  // going wrong rather than just showing empty/tofu. Rebuilt as real nested <Text> — a
  // strikethrough old price plus the new one — which needs no font to contain an arrow at all,
  // and reads as a clearer "was → now" than embedding a special character ever did.
  // `strikeColor` is a prop rather than fixed to one color: this renders both on a plain
  // surface row (colors.muted reads fine there) and inside the solid-green Pay button
  // (colors.muted would be low-contrast against green — colors.onGreenMuted is the pair
  // that exists specifically for a muted element on that background).
  function PriceText({ opt, strikeColor }: { opt: BoostPricingPreviewDto["boost7"] | undefined; strikeColor: string }) {
    if (!opt) return <>…</>;
    if (opt.free) return <>Free</>;
    if (!opt.discountApplied) return <>₹{opt.amount}</>;
    return (
      <>
        <Text style={{ textDecorationLine: "line-through", color: strikeColor }}>₹{opt.originalAmount}</Text>{" "}
        ₹{opt.amount}
      </>
    );
  }

  // Admin has moved this offer onto the ad-preview step instead — see
  // docs/plans/boost-instant-alerts-preview-selector.md. The two placements are mutually
  // exclusive, so this post-creation card stays hidden entirely rather than duplicating the offer.
  // A held referral credit is still offered, though — the preview-step selector can't spend one.
  const referralCredit = pricing?.referralCredit ?? null;
  const paidOptionsHidden = !!pricing?.showSelectorOnPreview && !ignorePlacementSetting;
  if (paidOptionsHidden && !referralCredit) return null;

  const freeBoost = referralCredit && (
    <ReferralFreeBoost
      credit={referralCredit}
      listingId={listingId}
      accessToken={accessToken}
      source={source}
      showPaidHint={!paidOptionsHidden}
      onActivated={onActivating}
    />
  );

  if (paidOptionsHidden) {
    return <View style={[styles.card, { borderColor: colors.gold, backgroundColor: colors.surfaceAlt }]}>{freeBoost}</View>;
  }

  return (
    <View style={[styles.card, { borderColor: colors.gold, backgroundColor: colors.surfaceAlt }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Icon name="boost" size={17} color={colors.gold} />
        <Text style={{ fontFamily: "serif", fontWeight: "700", fontSize: 15, color: colors.text }}>
          Reach more buyers, faster
          {/* Same discount-derived label as BoostPlanSelector's title — see its comment for why
              this is computed from the option's own amount/originalAmount rather than hardcoded. */}
          {option?.discountApplied && (
            <Text style={{ color: colors.gold }}> — {discountPercentFor(option.amount, option.originalAmount)}% OFF</Text>
          )}
        </Text>
      </View>

      {/* The real proof point, not just a listed benefit — see the prop's own comment. Same
        * message the web side already shows on its review-step recovery dialog, same honest
        * fallback when either cohort is still below MIN_SAMPLE_SIZE. */}
      <Text style={{ fontSize: 12.5, fontWeight: "700", color: colors.gold, marginBottom: 12 }}>
        {boostRecoveryMessage(effectiveness ?? null).headline}
      </Text>

      {freeBoost}

      <View style={{ gap: 8 }}>
        {offered.map((days) => {
          const opt = pricing ? boostOptionFor(pricing, days) : undefined;
          // Quoted against the 7-day price, so only while that option is on screen too.
          const saving = pricing && days !== 7 && offered.includes(7) ? boostSavings(pricing, days) : null;
          return (
            <Pressable
              key={days}
              onPress={() => setDuration(days)}
              disabled={pending}
              style={[
                styles.optionButton,
                {
                  borderColor: effectiveDuration === days ? colors.green : colors.border,
                  backgroundColor: effectiveDuration === days ? `${colors.green}1a` : colors.surface,
                  opacity: pending ? 0.5 : 1,
                },
              ]}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ fontWeight: "700", fontSize: 14, color: colors.text }}>Boost {days} days</Text>
                  {days === 30 && saving && (
                    <Text
                      style={{
                        fontSize: 10.5,
                        fontWeight: "700",
                        color: colors.onGreen,
                        backgroundColor: colors.green,
                        borderRadius: 6,
                        paddingHorizontal: 6,
                        paddingVertical: 1,
                        overflow: "hidden",
                      }}
                    >
                      Best value
                    </Text>
                  )}
                </View>
                {saving ? (
                  <Text style={{ fontSize: 12, color: colors.green }}>
                    ₹{saving.perDay}/day · save ₹{saving.rupees} ({saving.percent}%) vs the 7-day price
                  </Text>
                ) : (
                  opt &&
                  !opt.free && (
                    <Text style={{ fontSize: 12, color: colors.muted }}>₹{Math.round(opt.amount / days)}/day</Text>
                  )
                )}
              </View>
              <Text style={{ fontWeight: "700", fontSize: 14, color: colors.green }}>
                <PriceText opt={opt} strikeColor={colors.muted} />
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={{ fontSize: 12.5, color: colors.textSoft, marginTop: 10 }}>
        Instant Alerts is included: you are emailed and WhatsApp'd the moment someone messages you.
      </Text>

      {pending && <ActivityIndicator color={colors.green} style={{ marginTop: 14 }} />}
      {error && <Text style={{ color: "#c0554b", fontSize: 13, marginTop: 14 }}>{error}</Text>}

      <Pressable
        onPress={onPay}
        disabled={pending || !option}
        style={[styles.submitButton, { backgroundColor: colors.green, marginTop: 16, opacity: pending || !option ? 0.6 : 1 }]}
      >
        <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 14 }}>
          {option?.free ? (
            "Activate for free"
          ) : (
            <>
              Pay <PriceText opt={option} strikeColor={colors.onGreenMuted} />
            </>
          )}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: "100%", borderWidth: 1, borderRadius: 16, padding: 18 },
  optionButton: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1.5, borderRadius: 10, padding: 14 },
  submitButton: { borderRadius: 8, paddingVertical: 12, paddingHorizontal: 28, alignItems: "center" },
});
