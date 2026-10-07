"use client";

import type { BoostPricingPreviewDto } from "@bhavano/types";
import { boostOptionFor, defaultBoostDuration, offeredBoostDurations } from "@bhavano/types/boostPricing";
import { boostRecoveryMessage, type BoostEffectivenessDto } from "@bhavano/types/boostEffectiveness";
import { Icon } from "./Icon";

/**
 * One-time interstitial on the post-ad preview step, for a seller who's skipped Boost and is
 * either about to submit anyway or has sat idle for a while — see
 * docs/plans/boost-recovery-dialog.md. Makes the case with a real, computed number when there's
 * enough history to trust one (boostRecoveryMessage's own sample-size gate), and an honest
 * non-numeric line otherwise. Never a hard gate: both buttons proceed with posting, the only
 * difference is whether Boost gets added first.
 */
export function BoostRecoveryDialog({
  pricing,
  effectiveness,
  onAddBoost,
  onSkip,
}: {
  pricing: BoostPricingPreviewDto;
  effectiveness: BoostEffectivenessDto | null;
  /** Add the default duration's boost, then continue posting. */
  onAddBoost: () => void;
  /** Continue posting without boosting. */
  onSkip: () => void;
}) {
  const duration = defaultBoostDuration(offeredBoostDurations(pricing));
  const option = boostOptionFor(pricing, duration);
  const message = boostRecoveryMessage(effectiveness);

  const priceText = option.free
    ? "Free"
    : option.discountApplied
      ? `₹${option.originalAmount} → ₹${option.amount}`
      : `₹${option.amount}`;

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
            <span>Add {duration}-day Feature</span>
            <span>{priceText}</span>
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="bg-transparent border-0 p-0 text-[12.5px] font-bold text-muted underline cursor-pointer"
          >
            No thanks, post without featuring
          </button>
        </div>
      </div>
    </div>
  );
}
