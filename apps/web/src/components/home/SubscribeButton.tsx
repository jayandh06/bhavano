"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SubscriptionTier } from "@bhavano/types";
import { subscriptionPriceFor } from "@bhavano/types/subscriptionPricing";
import { createSubscriptionOrderAction } from "@/app/actions/payments";
import { loadRazorpayScript } from "@/lib/razorpay";
import { pushDataLayerEvent } from "@/lib/gtm";

const DURATIONS_BY_TIER: Record<SubscriptionTier, number[]> = {
  buyerPremium: [1, 6, 12],
  agentPro: [1],
  sellerSlotPack: [1],
};

const BUYER_PREMIUM_DURATION_LABELS: Record<number, string> = {
  1: "1 month",
  6: "6 months",
  12: "12 months — best value",
};

const TIER_LABELS: Record<SubscriptionTier, string> = {
  buyerPremium: "Bhavano Plus",
  agentPro: "Agent/Broker Pro",
  sellerSlotPack: "Seller slot pack",
};

export function SubscribeButton({
  tier,
  agentProUnits = 1,
}: {
  tier: SubscriptionTier;
  agentProUnits?: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingActivation, setPendingActivation] = useState(false);

  async function onSelectDuration(months: number) {
    setPending(true);
    setError(null);

    const result = await createSubscriptionOrderAction(tier, months, tier === "agentPro" ? agentProUnits : undefined);
    if (!result.success) {
      setPending(false);
      setError(result.error);
      return;
    }

    pushDataLayerEvent("begin_checkout_subscription", {
      transactionId: result.order.paymentId,
      tier,
      months,
      value: result.order.amount / 100,
      currency: result.order.currency,
    });

    try {
      await loadRazorpayScript();
      const { order } = result;
      if (!order.razorpayOrderId || !order.razorpayKeyId) {
        setPending(false);
        setError("Couldn't open checkout — please try again.");
        return;
      }
      const razorpay = new window.Razorpay({
        key: order.razorpayKeyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.razorpayOrderId,
        name: "Bhavano",
        description: `${TIER_LABELS[tier]} — ${months} month${months > 1 ? "s" : ""}`,
        handler: () => {
          setPendingActivation(true);
          pushDataLayerEvent("subscription_purchase", {
            transactionId: order.paymentId,
            tier,
            months,
            value: order.amount / 100,
            currency: order.currency,
          });
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
          type="button"
          onClick={() => onSelectDuration(months)}
          disabled={pending}
          className="flex justify-between items-center border-[1.5px] border-border rounded-[10px] px-4 py-3 text-sm font-bold text-text cursor-pointer bg-surface-alt disabled:opacity-50"
        >
          <span>
            {tier === "buyerPremium"
              ? (BUYER_PREMIUM_DURATION_LABELS[months] ?? `${months} months`)
              : tier === "sellerSlotPack"
                ? "10 active listings — 1 month"
                : months === 1
                  ? `1 month — ${agentProUnits * 20} listings`
                  : `${months} months`}
          </span>
          <span className="text-green">₹{subscriptionPriceFor(tier, months, agentProUnits)}</span>
        </button>
      ))}
      {error && <p className="text-[#b3413a] text-[13px] m-0">{error}</p>}
    </div>
  );
}
