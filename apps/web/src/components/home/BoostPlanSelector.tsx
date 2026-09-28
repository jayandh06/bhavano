"use client";

import type { BoostPlanSelection, BoostPricingPreviewDto, ListingCategory } from "@bhavano/types";
import { BOOST_DURATIONS, boostOptionFor, boostSavings } from "@bhavano/types/boostPricing";
import { listingPublishCheckoutTotalRupees } from "@bhavano/types/listingPublishPricing";
import type { PlatformFeeSettings } from "@bhavano/types/platformFeePricing";
import { platformFeeFor } from "@bhavano/types/platformFeePricing";
import { discountPercentFor } from "@bhavano/types/promoCode";
import { Icon } from "./Icon";

/**
 * Ad-preview-step counterpart to BoostBundlePicker — same duration-rows + Instant-Alerts-toggle
 * visual language and the same `optionKey` indexing into `BoostPricingPreviewDto`, but no Pay
 * button: this only ever reports the advertiser's choice back via `onChange`, and the actual
 * checkout happens after "Post ad" is clicked (PostAdWizard.tsx). Only rendered when the admin has
 * moved the offer here (`pricing.showSelectorOnPreview`) — see
 * docs/plans/boost-instant-alerts-preview-selector.md.
 *
 * `value === null` means the advertiser has explicitly skipped it — still fully optional, unlike
 * BoostBundlePicker where "skip" is simply never opening the picker. The wizard pre-fills a
 * default (15-day boost + Instant Alerts) the moment a category is picked, so this renders as an
 * already dimmed-in choice — "Skip" is what backs out of that default.
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
  /** When false, only the mandatory platform fee row is shown (fee-only publish). */
  showBoostOptions?: boolean;
}) {
  const platformFeeRupees =
    platformFeeSettings &&
    !platformFeeSettings.allowLivePublishWithPendingPayment &&
    platformFeeFor(category, platformFeeSettings) > 0
      ? platformFeeFor(category, platformFeeSettings)
      : 0;
  const effective: BoostPlanSelection = value ?? { duration: 15, includeInstantAlerts: true };

  const option = boostOptionFor(pricing, effective.duration);

  function priceText(opt: BoostPricingPreviewDto["boost7"]): string {
    if (opt.free) return "Free";
    return opt.discountApplied ? `₹${opt.originalAmount} → ₹${opt.amount}` : `₹${opt.amount}`;
  }

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
          Boost this ad (optional)
          {/* Computed from the option's own amount/originalAmount rather than hardcoded — the
            * real percent lives on an admin-edited DiscountCode row, so this can't go stale. */}
          {option.discountApplied && (
            <span className="text-[color:var(--gold)]"> — {discountPercentFor(option.amount, option.originalAmount)}% OFF</span>
          )}
        </span>
      </div>

      <div className="flex flex-col gap-2.5">
        {BOOST_DURATIONS.map((days) => {
          const selected = !!value && effective.duration === days;
          const opt = boostOptionFor(pricing, days);
          const saving = days !== 7 ? boostSavings(pricing, days) : null;
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
                  Boost {days} days
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
                  !opt.free && <span className="text-[12px] font-normal text-muted">₹{Math.round(opt.amount / days)}/day</span>
                )}
              </span>
              <span className="text-green">{priceText(opt)}</span>
            </button>
          );
        })}
      </div>
      <p className="text-[12.5px] text-text-soft mt-2.5 mb-0">Instant Alerts is included: you are emailed the moment someone messages you.</p>

      <p className="text-[13px] font-bold text-green mt-3 mb-0">{value ? `Boost add-on: ${priceText(option)}` : "Not boosting this ad"}</p>

      <button
        type="button"
        onClick={() => onChange(value ? null : effective)}
        className="mt-2.5 bg-transparent border-0 p-0 text-[12.5px] font-bold text-muted underline cursor-pointer"
      >
        {value ? "Skip — post without boosting" : "Add it back"}
      </button>
        </>
      )}

      {(platformFeeRupees > 0 || value) && (
        <p className="text-[13px] font-bold text-green mt-3 mb-0">Due today: ₹{dueToday}</p>
      )}
    </div>
  );
}
