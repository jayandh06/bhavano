import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { BoostPlanSelection, BoostPricingPreviewDto, ListingCategory } from "@bhavano/types";
import { boostOptionFor, boostSavings, defaultBoostDuration, offeredBoostDurations } from "@bhavano/types/boostPricing";
import { listingPublishCheckoutTotalRupees } from "@bhavano/types/listingPublishPricing";
import type { PlatformFeeSettings } from "@bhavano/types/platformFeePricing";
import { platformFeeFor } from "@bhavano/types/platformFeePricing";
import { useAppTheme } from "../../theme/ThemeContext";
import { discountPercentFor } from "@bhavano/types/promoCode";
import { Icon } from "../Icon";

/**
 * Ad-preview-step counterpart to BoostBundleCard — same duration-rows + Instant-Alerts-toggle
 * visual language and the same `optionKey` indexing into `BoostPricingPreviewDto`, but no
 * Pay/Activate button: this only ever reports the advertiser's choice back via `onChange`, and the
 * actual checkout happens after "Post ad" is tapped (PostAdWizard.tsx). Only rendered when the
 * admin has moved the offer here (`pricing.showSelectorOnPreview`) — see
 * docs/plans/boost-instant-alerts-preview-selector.md.
 *
 * `value === null` means the advertiser has explicitly skipped it, unlike BoostBundleCard where
 * "skip" is simply never showing the card. The wizard pre-fills a default (15-day boost + Instant
 * Alerts) the moment a category is picked, so this renders as an already dimmed-in choice — "Skip"
 * is what backs out of that default. The skip/"Add it back" link itself only renders when
 * `pricing.allowSkippingBoost` is not `false` (admin → Plans) — a standalone admin switch, not
 * derived from `showSelectorOnPreview` or whether a platform fee applies.
 */
export function BoostPlanSelector({
  pricing,
  value,
  onChange,
  category,
  platformFeeSettings,
  showBoostOptions = true,
}: {
  pricing: BoostPricingPreviewDto;
  value: BoostPlanSelection | null;
  onChange: (value: BoostPlanSelection | null) => void;
  category: ListingCategory;
  platformFeeSettings?: PlatformFeeSettings;
  showBoostOptions?: boolean;
}) {
  const { colors } = useAppTheme();
  const offered = offeredBoostDurations(pricing);
  const effective: BoostPlanSelection =
    value && offered.includes(value.duration)
      ? value
      : { duration: defaultBoostDuration(offered), includeInstantAlerts: true };

  // The wizard pre-fills 15 days before the prices (and so the offered durations) arrive; if admin
  // has switched that one off, move the choice the wizard will check out with onto one on offer.
  useEffect(() => {
    if (value && !offered.includes(value.duration)) onChange({ ...value, duration: defaultBoostDuration(offered) });
  }, [value, offered, onChange]);
  const platformFeeRupees =
    platformFeeSettings &&
    !platformFeeSettings.allowLivePublishWithPendingPayment &&
    platformFeeFor(category, platformFeeSettings) > 0
      ? platformFeeFor(category, platformFeeSettings)
      : 0;
  const dueToday =
    platformFeeRupees > 0 || value
      ? listingPublishCheckoutTotalRupees(
          category,
          platformFeeSettings ?? {
            propertyListingFee: 0,
            coworkingPgStorageListingFee: 0,
            furnitureInteriorsListingFee: 0,
            allowLivePublishWithPendingPayment: false,
          },
          pricing,
          value,
        )
      : platformFeeRupees;

  const option = boostOptionFor(pricing, effective.duration);

  // Was a single string with a "→" glyph — reported on Android as rendering as a stray "'n"
  // instead of an arrow (see BoostBundleCard's identical PriceText for the likely cause: this
  // app's custom fonts have no glyph for U+2192). Both places this renders here sit on a plain
  // surface, so colors.muted always reads fine — no need for BoostBundleCard's strikeColor prop.
  function PriceText({ opt }: { opt: BoostPricingPreviewDto["boost7"] }) {
    if (opt.free) return <>Free</>;
    if (!opt.discountApplied) return <>₹{opt.amount}</>;
    return (
      <>
        <Text style={{ textDecorationLine: "line-through", color: colors.muted }}>₹{opt.originalAmount}</Text>{" "}
        ₹{opt.amount}
      </>
    );
  }

  return (
    <View style={[styles.card, { borderColor: colors.gold, backgroundColor: colors.surfaceAlt, opacity: showBoostOptions && !value ? 0.55 : 1 }]}>
      {platformFeeRupees > 0 && (
        <View style={[styles.optionButton, { borderColor: colors.green, backgroundColor: `${colors.green}1a`, marginBottom: 12 }]}>
          <Text style={{ flex: 1, fontWeight: "700", fontSize: 14, color: colors.text }}>Platform fee (required)</Text>
          <Text style={{ fontWeight: "700", fontSize: 14, color: colors.green }}>₹{platformFeeRupees}</Text>
        </View>
      )}

      {showBoostOptions && (
        <>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Icon name="boost" size={17} color={colors.gold} />
        <Text style={{ fontFamily: "serif", fontWeight: "700", fontSize: 15, color: colors.text }}>
          Boost this ad
          {/* Appended only while a discount is actually live on the option being shown, and
              computed from its own amount/originalAmount rather than a hardcoded "50" — the real
              percent lives on an admin-edited DiscountCode row, so this can't quietly go stale. */}
          {option.discountApplied && (
            <Text style={{ color: colors.gold }}> — {discountPercentFor(option.amount, option.originalAmount)}% OFF</Text>
          )}
        </Text>
      </View>

      <View style={{ gap: 8 }}>
        {offered.map((days) => {
          const opt = boostOptionFor(pricing, days);
          // Quoted against the 7-day price, so only while that option is on screen too.
          const saving = days !== 7 && offered.includes(7) ? boostSavings(pricing, days) : null;
          return (
            <Pressable
              key={days}
              onPress={() => onChange({ duration: days, includeInstantAlerts: true })}
              style={[
                styles.optionButton,
                {
                  borderColor: !!value && effective.duration === days ? colors.green : colors.border,
                  backgroundColor: !!value && effective.duration === days ? `${colors.green}1a` : colors.surface,
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
                <PriceText opt={opt} />
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={{ fontSize: 12.5, color: colors.textSoft, marginTop: 10 }}>
        Instant Alerts is included: you are emailed and WhatsApp'd the moment someone messages you.
      </Text>

      <Text style={{ fontWeight: "700", fontSize: 13, color: colors.green, marginTop: 12 }}>
        {value ? (
          <>
            Total: <PriceText opt={option} />
          </>
        ) : (
          "Not boosting this ad"
        )}
      </Text>

      {pricing.allowSkippingBoost !== false && (
        <Pressable onPress={() => onChange(value ? null : effective)} style={{ marginTop: 10 }}>
          <Text style={{ fontSize: 12.5, fontWeight: "700", color: colors.muted, textDecorationLine: "underline" }}>
            {value ? "Skip — post without boosting" : "Add it back"}
          </Text>
        </Pressable>
      )}
        </>
      )}

      {(platformFeeRupees > 0 || value) && (
        <Text style={{ fontWeight: "700", fontSize: 13, color: colors.green, marginTop: 12 }}>Due today: ₹{dueToday}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: "100%", borderWidth: 1, borderRadius: 16, padding: 18 },
  optionButton: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1.5, borderRadius: 10, padding: 14 },
});
