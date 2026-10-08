"use client";

import type { BoostPricingPreviewDto } from "@bhavano/types";
import { boostOptionFor, defaultBoostDuration, offeredBoostDurations } from "@bhavano/types/boostPricing";
import { boostRecoveryMessage, type BoostEffectivenessDto } from "@bhavano/types/boostEffectiveness";
import { Icon } from "./Icon";

/**
 * Interstitial making the case for Feature before a seller actually leaves without it — see
 * docs/plans/boost-recovery-dialog.md. Three trigger points share this one component (idle on the
 * review step, tapping Post ad, and clicking the Skip link itself — PostAdWizard tracks which),
 * and only differ in what onAddBoost/onSkip actually do: the idle/submit triggers proceed straight
 * to posting either way (the only difference is whether Feature gets added first), while the
 * skip-click trigger just resolves the pending choice and returns to the review screen — neither
 * button there posts anything. addLabel/cancelLabel let that one call site use wording that
 * matches ("Apply Feature" / "Cancel") instead of the posting-flow default.
 */
export function BoostRecoveryDialog({
  pricing,
  effectiveness,
  onAddBoost,
  onSkip,
  addLabel,
  cancelLabel = "No thanks, post without featuring",
}: {
  pricing: BoostPricingPreviewDto;
  effectiveness: BoostEffectivenessDto | null;
  /** Resolve in favor of Feature — label and consequence both depend on the trigger (see above). */
  onAddBoost: () => void;
  /** Resolve against Feature — label and consequence both depend on the trigger (see above). */
  onSkip: () => void;
  /** Defaults to "Add {duration}-day Feature — {price}"; pass to override for a trigger where
   * nothing is being charged right now (the skip-click case just restores a selection). */
  addLabel?: string;
  cancelLabel?: string;
}) {
  const duration = defaultBoostDuration(offeredBoostDurations(pricing));
  const option = boostOptionFor(pricing, duration);
  const message = boostRecoveryMessage(effectiveness);

  // Strikes out the original price — same convention as BoostBundlePicker's PriceTag and
  // BoostPlanSelector's PriceDisplay, so an offer reads the same way everywhere on the preview
  // flow. On the green "Add Feature" button here, so the muted variant uses on-green/70, not
  // text-muted (which would be unreadable against this background).
  const priceDisplay = option.free ? (
    "Free"
  ) : (
    <>
      {option.discountApplied && <span className="line-through mr-1.5 text-on-green/70">₹{option.originalAmount}</span>}
      ₹{option.amount}
    </>
  );

  return (
    <div
      onClick={onSkip}
      className="fixed inset-0 bg-[var(--modal-scrim)] z-[110] flex items-center justify-center p-5"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface rounded-2xl w-[420px] max-w-full p-6 animate-[modalIn_0.2s_ease_both]"
      >
        <div className="flex justify-between items-start mb-1.5">
          <div className="flex items-center gap-2">
            <Icon name="boost" className="text-[color:var(--gold)] text-lg" />
            <div className="font-lora font-bold text-[18px] text-text">Before you post…</div>
          </div>
          <button onClick={onSkip} aria-label="Close" className="bg-transparent border-0 text-xl cursor-pointer text-muted">
            <Icon name="close" />
          </button>
        </div>

        <p className="text-[14px] text-text leading-[1.5] mb-1 mt-3">{message.headline}</p>
        {!message.hasEnoughData && (
          <p className="text-[12px] text-muted leading-[1.5] mb-0">
            Feature puts your ad higher in search and gives it a badge buyers notice.
          </p>
        )}

        <div className="flex flex-col gap-2.5 mt-4">
          <button
            type="button"
            onClick={onAddBoost}
            className="flex items-center justify-between gap-3 border-0 rounded-lg px-4 py-3 text-sm font-bold cursor-pointer bg-green text-on-green"
          >
            <span>{addLabel ?? `Add ${duration}-day Feature`}</span>
            {!addLabel && <span>{priceDisplay}</span>}
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="bg-transparent border-0 p-0 text-[12.5px] font-bold text-muted underline cursor-pointer"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
