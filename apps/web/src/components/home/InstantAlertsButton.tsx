"use client";

import { useState } from "react";
import { useInstantAlerts } from "./InstantAlertsProvider";
import { Icon } from "./Icon";

/** "Get Instant Alerts" — the trigger only, same split as BoostButton/BoostProvider: the
 * confirmation modal + Razorpay checkout live in the one shared InstantAlertsProvider. Instant
 * Alerts only activates once the BFF webhook confirms payment, not on the checkout callback. */
const OUTLINE_CLASS =
  "text-[13px] font-bold text-green border-[1.5px] border-green rounded-lg px-3.5 py-2 whitespace-nowrap cursor-pointer bg-transparent";

export function InstantAlertsButton({
  listingId,
  /** Full class override for the trigger — defaults to the outlined pill used on /my-listings.
   * The post-ad success screen passes a filled full-width variant. */
  className = OUTLINE_CLASS,
}: {
  listingId: string;
  className?: string;
}) {
  const { getInstantAlerts } = useInstantAlerts();
  const [pendingActivation, setPendingActivation] = useState(false);

  if (pendingActivation) {
    return (
      <span className="inline-flex items-center justify-center gap-1.5 text-[13px] font-bold text-green whitespace-nowrap">
        <Icon name="bell" /> Instant Alerts pending…
      </span>
    );
  }

  return (
    <button
      onClick={() => getInstantAlerts({ listingId, onActivating: () => setPendingActivation(true) })}
      className={className}
    >
      <Icon name="bell" /> Get Instant Alerts
    </button>
  );
}
