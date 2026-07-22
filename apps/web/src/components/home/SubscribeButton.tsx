"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SubscriptionTier } from "@bhavano/types";
import { subscriptionPriceFor } from "@bhavano/types/subscriptionPricing";
import { createSubscriptionOrderAction } from "@/app/actions/payments";
import { loadRazorpayScript } from "@/lib/razorpay";

const DURATIONS_BY_TIER: Record<SubscriptionTier, number[]> = {
  buyerPremium: [1, 12],
  agentPro: [1],
};

const TIER_LABELS: Record<SubscriptionTier, string> = {
  buyerPremium: "Bhavano Plus",
  agentPro: "Agent/Broker Pro",
};

/** Duration/price picker + Razorpay Checkout for a subscription tier — same order-then-webhook-
 * confirms pattern as BoostButton, just inline rather than in a modal since the /premium page
 * already gives each tier its own dedicated section for context. */
export function SubscribeButton({ tier }: { tier: SubscriptionTier }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingActivation, setPendingActivation] = useState(false);

  async function onSelectDuration(months: number) {
    setPending(true);
    setError(null);

    const result = await createSubscriptionOrderAction(tier, months);
    if (!result.success) {
      setPending(false);
      setError(result.error);
      return;
    }

    try {
      await loadRazorpayScript();
      const { order } = result;
      const razorpay = new window.Razorpay({
        key: order.razorpayKeyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.razorpayOrderId,
        name: "Bhavano",
        description: `${TIER_LABELS[tier]} — ${months} month${months > 1 ? "s" : ""}`,
        handler: () => {
          setPendingActivation(true);
          // The webhook (not this callback) is what actually activates the subscription — give
          // it a few seconds, then refresh so the page reflects the new status.
          setTimeout(() => router.refresh(), 4000);
        },
        modal: { ondismiss: () => setPending(false) },
      });
      razorpay.open();
    } catch {
      setPending(false);
      setError("Couldn't open checkout — please try again.");
    }
  }

  if (pendingActivation) {
    return <p className="text-[13px] font-bold text-green m-0">Activating your subscription…</p>;
  }

  return (
    <div className="flex flex-col gap-2.5">
      {DURATIONS_BY_TIER[tier].map((months) => (
        <button
          key={months}
          onClick={() => onSelectDuration(months)}
          disabled={pending}
          className="flex justify-between items-center border-[1.5px] border-border rounded-[10px] px-4 py-3 text-sm font-bold text-text cursor-pointer bg-surface-alt disabled:opacity-50"
        >
          <span>{months === 1 ? "1 month" : `${months} months`}</span>
          <span className="text-green">₹{subscriptionPriceFor(tier, months)}</span>
        </button>
      ))}
      {error && <p className="text-[#b3413a] text-[13px] m-0">{error}</p>}
    </div>
  );
}
