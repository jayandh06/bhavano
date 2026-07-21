"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ListingCategory } from "@bhavano/types";
import { boostPriceFor, type BoostDurationDays } from "@bhavano/types/boostPricing";
import { createBoostOrderAction } from "@/app/actions/payments";

declare global {
  interface Window {
    Razorpay: new (options: RazorpayCheckoutOptions) => { open: () => void };
  }
}

interface RazorpayCheckoutOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description: string;
  handler: () => void;
  modal?: { ondismiss?: () => void };
}

const CHECKOUT_SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";
const BOOST_DURATIONS: BoostDurationDays[] = [7, 15];

function loadRazorpayScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = CHECKOUT_SCRIPT_SRC;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay checkout"));
    document.body.appendChild(script);
  });
}

/** "🚀 Boost this ad" — opens a small duration/price picker, then Razorpay Checkout. The boost
 * itself only activates once the BFF's webhook confirms payment (not this click), so success
 * here just means checkout completed — the badge/sort position updates within a few seconds.
 * See docs/plans/monetization-boosted-listings-premium-tiers.md. */
export function BoostButton({ listingId, category }: { listingId: string; category: ListingCategory }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingActivation, setPendingActivation] = useState(false);

  async function onSelectDuration(days: BoostDurationDays) {
    setPending(true);
    setError(null);

    const result = await createBoostOrderAction(listingId, days);
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
        description: `Boost this ad for ${days} days`,
        handler: () => {
          setOpen(false);
          setPendingActivation(true);
          // The webhook (not this callback) is what actually activates the boost — give it a
          // few seconds, then refresh so the "Featured" badge/sort position reflects it.
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
    return <span className="text-[13px] font-bold text-green whitespace-nowrap">Boost pending…</span>;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(true)}
        className="text-[13px] font-bold text-green border-[1.5px] border-green rounded-lg px-3.5 py-2 whitespace-nowrap cursor-pointer bg-transparent"
      >
        🚀 Boost this ad
      </button>

      {open && (
        <div
          onClick={() => !pending && setOpen(false)}
          className="fixed inset-0 bg-[var(--modal-scrim)] z-[100] flex items-center justify-center p-5"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-surface rounded-2xl w-[360px] max-w-full p-6 animate-[modalIn_0.2s_ease_both]"
          >
            <div className="font-lora font-bold text-[17px] text-text mb-1">Boost this ad</div>
            <p className="text-[13px] text-muted mb-4 m-0">
              Featured listings rank ahead of regular ones and rotate through the top slots fairly —
              no one stays #1 forever.
            </p>
            <div className="flex flex-col gap-2.5">
              {BOOST_DURATIONS.map((days) => (
                <button
                  key={days}
                  onClick={() => onSelectDuration(days)}
                  disabled={pending}
                  className="flex justify-between items-center border-[1.5px] border-border rounded-[10px] px-4 py-3 text-sm font-bold text-text cursor-pointer bg-surface-alt disabled:opacity-50"
                >
                  <span>{days} days</span>
                  <span className="text-green">₹{boostPriceFor(category, days)}</span>
                </button>
              ))}
            </div>
            {error && <p className="text-[#b3413a] text-[13px] mt-3 mb-0">{error}</p>}
            <button
              onClick={() => setOpen(false)}
              disabled={pending}
              className="mt-4 bg-transparent border-0 text-muted text-[13px] font-bold cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
