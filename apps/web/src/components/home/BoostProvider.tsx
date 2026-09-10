"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { ListingCategory } from "@bhavano/types";
import { boostPriceFor, type BoostDurationDays } from "@bhavano/types/boostPricing";
import { createBoostOrderAction } from "@/app/actions/payments";
import { loadRazorpayScript } from "@/lib/razorpay";
import { pushDataLayerEvent } from "@/lib/gtm";

/**
 * One shared "boost this ad" duration/price picker for the whole app. Each `BoostButton` used to
 * inline its own copy of this modal + Razorpay wiring; on a list of listings that's N of them,
 * only one reachable at a time purely because its full-screen scrim blocked the other buttons.
 * This is the single instance at layout level — `BoostButton` keeps only its own "Boost
 * pending…" pill.
 *
 * The boost activates on the BFF webhook, not the checkout callback, so success here just means
 * "payment done" — the provider triggers a `router.refresh()` a few seconds later and calls
 * `onActivating` so the trigger can show its pending state.
 */

const BOOST_DURATIONS: BoostDurationDays[] = [7, 15];

interface BoostOptions {
  listingId: string;
  category: ListingCategory;
  /** Fired when the boost is either activated for free (Pro credit) or paid for — the trigger
   * uses it to swap itself for a "Boost pending…" label while the webhook catches up. */
  onActivating?: () => void;
}

interface BoostContextValue {
  boost: (options: BoostOptions) => void;
}

const BoostContext = createContext<BoostContextValue | null>(null);

export function useBoost(): BoostContextValue {
  const ctx = useContext(BoostContext);
  if (!ctx) throw new Error("useBoost must be used within BoostProvider");
  return ctx;
}

export function BoostProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<BoostOptions | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function boost(options: BoostOptions) {
    setOpts(options);
    setError(null);
    setPending(false);
    setOpen(true);
  }

  function close() {
    if (pending) return;
    setOpen(false);
  }

  async function onSelectDuration(days: BoostDurationDays) {
    if (!opts) return;
    const { listingId, category, onActivating } = opts;
    setPending(true);
    setError(null);

    const result = await createBoostOrderAction(listingId, days);
    if (!result.success) {
      setPending(false);
      setError(result.error);
      return;
    }

    if (result.order.activated) {
      setOpen(false);
      setPending(false);
      onActivating?.();
      setTimeout(() => router.refresh(), 1500);
      return;
    }

    if (!result.order.razorpayOrderId || !result.order.razorpayKeyId) {
      setPending(false);
      setError("Couldn't open checkout — please try again.");
      return;
    }

    const { order } = result;
    pushDataLayerEvent("begin_checkout_boost", {
      transactionId: order.paymentId,
      listingId,
      category,
      boostDays: days,
      value: order.amount / 100,
      currency: order.currency,
    });

    try {
      await loadRazorpayScript();
      const razorpay = new window.Razorpay({
        // Both non-null by the guard just above.
        key: order.razorpayKeyId!,
        amount: order.amount,
        currency: order.currency,
        order_id: order.razorpayOrderId!,
        name: "Bhavano",
        description: `Boost this ad for ${days} days`,
        handler: () => {
          setOpen(false);
          setPending(false);
          onActivating?.();
          pushDataLayerEvent("boost_purchase", {
            transactionId: order.paymentId,
            listingId,
            category,
            boostDays: days,
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

  return (
    <BoostContext.Provider value={{ boost }}>
      {children}

      {open && opts && (
        <div
          onClick={close}
          className="fixed inset-0 bg-[var(--modal-scrim)] z-[110] flex items-center justify-center p-5"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-surface rounded-2xl w-[360px] max-w-full p-6 animate-[modalIn_0.2s_ease_both]"
          >
            <div className="font-lora font-bold text-[17px] text-text mb-1">Boost this ad</div>
            <p className="text-[13px] text-muted mb-4 m-0">
              Featured listings rank ahead of regular ones and rotate through the top slots fairly — no one stays #1
              forever.
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
                  <span className="text-green">₹{boostPriceFor(opts.category, days)}</span>
                </button>
              ))}
            </div>
            {error && <p className="text-[#b3413a] text-[13px] mt-3 mb-0">{error}</p>}
            <button
              onClick={close}
              disabled={pending}
              className="mt-4 bg-transparent border-0 text-muted text-[13px] font-bold cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </BoostContext.Provider>
  );
}
