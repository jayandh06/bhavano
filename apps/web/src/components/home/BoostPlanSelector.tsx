"use client";

import type { BoostPlanSelection, BoostPricingPreviewDto } from "@bhavano/types";
import type { BoostDurationDays } from "@bhavano/types/boostPricing";
import { Icon } from "./Icon";

const BOOST_DURATIONS: BoostDurationDays[] = [7, 15];

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
}: {
  pricing: BoostPricingPreviewDto;
  value: BoostPlanSelection | null;
  onChange: (value: BoostPlanSelection | null) => void;
}) {
  const effective: BoostPlanSelection = value ?? { duration: 15, includeInstantAlerts: true };

  const optionKey =
    effective.duration === 7
      ? effective.includeInstantAlerts
        ? "boost7WithInstantAlerts"
        : "boost7"
      : effective.includeInstantAlerts
        ? "boost15WithInstantAlerts"
        : "boost15";
  const option = pricing[optionKey];

  function priceText(opt: BoostPricingPreviewDto["boost7"]): string {
    if (opt.free) return "Free";
    return opt.discountApplied ? `₹${opt.originalAmount} → ₹${opt.amount}` : `₹${opt.amount}`;
  }

  return (
    <div
      className={`w-full rounded-2xl border border-[color:var(--gold)]/40 bg-surface-alt/60 p-4 sm:p-5 ${value ? "" : "opacity-60"}`}
    >
      <div className="flex items-center gap-2 mb-3">
        <Icon name="boost" className="text-[color:var(--gold)] text-lg" />
        <span className="font-lora font-bold text-[15px] text-text">Boost this ad</span>
      </div>

      <div className="flex flex-col gap-2.5">
        {BOOST_DURATIONS.map((days) => {
          const selected = !!value && effective.duration === days;
          return (
            <button
              key={days}
              type="button"
              onClick={() => onChange({ duration: days, includeInstantAlerts: effective.includeInstantAlerts })}
              className={`flex justify-between items-center border-[1.5px] rounded-[10px] px-4 py-3 text-sm font-bold cursor-pointer ${
                selected ? "border-green bg-green/10 text-text" : "border-border bg-surface-alt text-text"
              }`}
            >
              <span>Boost {days} days</span>
              <span className="text-green">{priceText(days === 7 ? pricing.boost7 : pricing.boost15)}</span>
            </button>
          );
        })}

        <label className="flex items-center justify-between gap-2 border-[1.5px] border-border rounded-[10px] px-4 py-3 text-sm font-bold text-text cursor-pointer bg-surface-alt">
          <span className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={effective.includeInstantAlerts}
              onChange={(e) => onChange({ duration: effective.duration, includeInstantAlerts: e.target.checked })}
            />
            Add Instant Alerts
          </span>
        </label>
      </div>

      <p className="text-[13px] font-bold text-green mt-3 mb-0">{value ? `Total: ${priceText(option)}` : "Not boosting this ad"}</p>

      <button
        type="button"
        onClick={() => onChange(value ? null : effective)}
        className="mt-2.5 bg-transparent border-0 p-0 text-[12.5px] font-bold text-muted underline cursor-pointer"
      >
        {value ? "Skip — post without boosting" : "Add it back"}
      </button>
    </div>
  );
}
