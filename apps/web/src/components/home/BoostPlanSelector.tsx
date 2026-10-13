"use client";

import { useEffect } from "react";
import type { BoostPlanSelection, BoostPricingPreviewDto, ListingCategory } from "@bhavano/types";
import { boostOptionFor, boostSavings, defaultBoostDuration, offeredBoostDurations } from "@bhavano/types/boostPricing";
import { listingPublishCheckoutTotalRupees } from "@bhavano/types/listingPublishPricing";
import type { PlatformFeeSettings } from "@bhavano/types/platformFeePricing";
import { platformFeeFor } from "@bhavano/types/platformFeePricing";
import { discountPercentFor } from "@bhavano/types/promoCode";
import { boostRecoveryMessage } from "@bhavano/types/boostEffectiveness";
import type { BoostEffectivenessDto } from "@bhavano/types/boostEffectiveness";
import { Icon } from "./Icon";

// Strikes out the original price rather than an arrow (₹149 → ₹99) — same convention as
// BoostBundlePicker's PriceTag, so an offer being applied reads the same way everywhere a boost
// price is shown, not just as a lower number that could be mistaken for the plain price. A
// top-level function, not one declared inside BoostPlanSelector's body: a component recreated on
// every render resets its own state each time (react-hooks/static-components) — it has none here,
// but the lint rule doesn't know that, and the fix is the same either way.
function PriceDisplay({ opt }: { opt: BoostPricingPreviewDto["boost7"] }) {
  if (opt.free) return <>Free</>;
  return (
    <>
      {opt.discountApplied && <span className="line-through mr-1.5 text-muted">₹{opt.originalAmount}</span>}
      ₹{opt.amount}
    </>
  );
}

/**
 * Ad-preview-step counterpart to BoostBundlePicker — same duration-rows + Instant-Alerts-toggle
 * visual language and the same `optionKey` indexing into `BoostPricingPreviewDto`, but no Pay
 * button: this only ever reports the advertiser's choice back via `onChange`, and the actual
 * checkout happens after "Post ad" is clicked (PostAdWizard.tsx). Only rendered when the admin has
 * moved the offer here (`pricing.showSelectorOnPreview`) — see
 * docs/plans/boost-instant-alerts-preview-selector.md.
 *
 * `value === null` means the advertiser has explicitly skipped it, unlike BoostBundlePicker where
 * "skip" is simply never opening the picker. The wizard pre-fills a default (15-day boost +
 * Instant Alerts) the moment a category is picked, so this renders as an already dimmed-in choice
 * — "Skip" is what backs out of that default. The skip/"Add it back" link itself only renders when
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
  showPriceSummary = true,
  effectiveness = null,
  onSkipAttempt,
}: {
  pricing: BoostPricingPreviewDto;
  value: BoostPlanSelection | null;
  onChange: (value: BoostPlanSelection | null) => void;
  category: ListingCategory;
  platformFeeSettings?: PlatformFeeSettings;
  /** When false, only the mandatory platform fee row is shown (fee-only publish). */
  showBoostOptions?: boolean;
  /** Hide repeated add-on/checkout totals on the ad Preview step; keep them in recovery checkout. */
  showPriceSummary?: boolean;
  effectiveness?: BoostEffectivenessDto | null;
  /** Called instead of `onChange(null)` when Skip is clicked from a selected state, so the parent
   * can interpose a dialog before actually committing to skipping — see PostAdWizard.tsx's
   * handleBoostSkipAttempt. Omit to skip immediately (the old, direct behavior); "Add it back"
   * (the opposite direction) is always direct, never intercepted. */
  onSkipAttempt?: () => void;
}) {
  const platformFeeRupees =
    platformFeeSettings &&
    !platformFeeSettings.allowLivePublishWithPendingPayment &&
    platformFeeFor(category, platformFeeSettings) > 0
      ? platformFeeFor(category, platformFeeSettings)
      : 0;
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

  const option = boostOptionFor(pricing, effective.duration);
  const effectivenessMessage = boostRecoveryMessage(effectiveness);

  const dueToday =
    platformFeeRupees > 0 || value
      ? listingPublishCheckoutTotalRupees(category, platformFeeSettings ?? { propertyListingFee: 0, coworkingPgStorageListingFee: 0, furnitureInteriorsListingFee: 0, allowLivePublishWithPendingPayment: false }, pricing, value)
      : platformFeeRupees;

  return (
    <div
      className={`w-full rounded-2xl border border-[color:var(--gold)]/40 bg-surface-alt/60 p-4 sm:p-5 ${showBoostOptions && !value ? "opacity-60" : ""}`}
    >
      {platformFeeRupees > 0 && (
        <div className="flex justify-between items-center border-[1.5px] border-green bg-green/10 rounded-[10px] px-4 py-3 text-sm font-bold text-text mb-3">
          <span>Platform fee (required)</span>
          <span className="text-green">₹{platformFeeRupees}</span>
        </div>
      )}

      {showBoostOptions && (
        <>
      <div className="flex items-center gap-2 mb-3">
        <Icon name="boost" className="text-[color:var(--gold)] text-lg" />
        <span className="font-lora font-bold text-[15px] text-text">
          Feature this ad
          {/* Computed from the option's own amount/originalAmount rather than hardcoded — the
            * real percent lives on an admin-edited DiscountCode row, so this can't go stale. */}
          {option.discountApplied && (
            <span className="text-[color:var(--gold)]"> — {discountPercentFor(option.amount, option.originalAmount)}% OFF</span>
          )}
        </span>
      </div>

      <div className="flex flex-col gap-2.5">
        {offered.map((days) => {
          const selected = !!value && effective.duration === days;
          const opt = boostOptionFor(pricing, days);
          // Quoted against the 7-day price, so only while that option is on screen too.
          const saving = days !== 7 && offered.includes(7) ? boostSavings(pricing, days) : null;
          return (
            <button
              key={days}
              type="button"
              // Instant Alerts is included in every boost, so it is always sent as included.
              onClick={() => onChange({ duration: days, includeInstantAlerts: true })}
              className={`flex justify-between items-center gap-3 border-[1.5px] rounded-[10px] px-4 py-3 text-sm font-bold cursor-pointer ${
                selected ? "border-green bg-green/10 text-text" : "border-border bg-surface-alt text-text"
              }`}
            >
              <span className="flex flex-col items-start gap-0.5 text-left">
                <span className="flex items-center gap-2">
                  Feature for {days} days
                  {days === 30 && saving && (
                    <span className="text-[10.5px] font-bold text-on-green bg-green rounded-md px-1.5 py-[1px]">
                      Best value
                    </span>
                  )}
                </span>
                {saving ? (
                  <span className="text-[12px] font-normal text-green">
                    ₹{saving.perDay}/day · save ₹{saving.rupees} ({saving.percent}%) vs the 7-day price
                  </span>
                ) : (
                  !opt.free && (
                    <span className="text-[12px] font-normal text-muted">
                      ₹{Math.round(opt.amount / days)}/day
                    </span>
                  )
                )}
              </span>
              <span className="text-green">
                <PriceDisplay opt={opt} />
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 rounded-xl border border-[color:var(--gold)]/30 bg-surface px-3.5 py-3">
        <p className="m-0 mb-2 font-bold text-[13px] text-text">Featured gets you:</p>
        <ul className="flex flex-col gap-1.5 text-[12.5px] text-text-soft m-0 pl-5">
          <li>A gold Featured badge and highlighted card that stand out from standard listings.</li>
          <li>Priority placement above regular listings in relevant browsing results; exact position can vary.</li>
          <li>Eligibility for the Featured listings rail when matching inventory is available for a visitor&apos;s category and city.</li>
          <li>Instant Alerts by email and WhatsApp when someone messages or shows interest while your boost is active.</li>
          <li>A daily recap of views, favourites, and new messages on ads still Featured when the digest is sent.</li>
        </ul>
        {effectivenessMessage.hasEnoughData && (
          <p className="m-0 mt-2 text-[12px] font-bold text-[color:var(--gold)]">
            {effectivenessMessage.headline}
          </p>
        )}
      </div>

      {showPriceSummary && (
        <p className="text-[13px] font-bold text-green mt-3 mb-0">
          {value ? (
            <>
              Feature add-on: <PriceDisplay opt={option} />
            </>
          ) : (
            "Not featuring this ad"
          )}
        </p>
      )}

      {pricing.allowSkippingBoost !== false && (
        // A real bordered button, not bare underlined text — this used to be sized no bigger
        // than its own words, sitting right under several bold bordered buttons above it, and
        // got missed. Deliberately neutral (no green, no fill) rather than styled like the
        // Feature options above: still the de-emphasized choice, just no longer an invisible one.
        <button
          type="button"
          onClick={() => (value ? (onSkipAttempt ? onSkipAttempt() : onChange(null)) : onChange(effective))}
          className="mt-2.5 w-full border-[1.5px] border-border rounded-[10px] px-4 py-2.5 text-[13px] font-bold text-muted bg-surface-alt cursor-pointer"
        >
          {value ? "Skip — post without featuring" : "Add it back"}
        </button>
      )}
        </>
      )}

      {showPriceSummary && (platformFeeRupees > 0 || value) && (
        <p className="text-[13px] font-bold text-green mt-3 mb-0">Due today: ₹{dueToday}</p>
      )}
    </div>
  );
}
