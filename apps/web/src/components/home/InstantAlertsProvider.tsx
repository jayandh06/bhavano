"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_INSTANT_ALERTS_PRICE_SETTINGS, type InstantAlertsPriceSettings } from "@bhavano/types/instantAlertsPricing";
import { createInstantAlertsOrderAction, fetchInstantAlertsPricingAction } from "@/app/actions/payments";
import { loadRazorpayScript } from "@/lib/razorpay";
import { pushDataLayerEvent } from "@/lib/gtm";

/**
 * One shared "get Instant Alerts" confirmation modal for the whole app — same reasoning as
 * BoostProvider/BuyCreditsProvider. Flat fee, no duration/pack picker (unlike Boost) — closer in
 * shape to BuyCreditsProvider's single-confirm flow than Boost's multi-option one.
 *
 * Activates on the BFF webhook, not the checkout callback — success here means "payment done";
 * the provider triggers a `router.refresh()` a few seconds later and calls `onActivating` so the
 * trigger can show its pending state.
 */

interface InstantAlertsOptions {
  listingId: string;
  onActivating?: () => void;
}

interface InstantAlertsContextValue {
  getInstantAlerts: (options: InstantAlertsOptions) => void;
}

const InstantAlertsContext = createContext<InstantAlertsContextValue | null>(null);

export function useInstantAlerts(): InstantAlertsContextValue {
  const ctx = useContext(InstantAlertsContext);
  if (!ctx) throw new Error("useInstantAlerts must be used within InstantAlertsProvider");
  return ctx;
}

export function InstantAlertsProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<InstantAlertsOptions | null>(null);
  const [discountCode, setDiscountCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onActivatingRef = useRef<(() => void) | undefined>(undefined);
  const [priceSettings, setPriceSettings] = useState<InstantAlertsPriceSettings>(
    DEFAULT_INSTANT_ALERTS_PRICE_SETTINGS,
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetchInstantAlertsPricingAction().then((settings) => {
      if (!cancelled) setPriceSettings(settings);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  function getInstantAlerts(options: InstantAlertsOptions) {
    onActivatingRef.current = options.onActivating;
    setOpts(options);
    setDiscountCode("");
    setError(null);
    setPending(false);
    setOpen(true);
  }

  function close() {
    if (pending) return;
    setOpen(false);
  }

  async function onConfirm() {
    if (!opts) return;
    const { listingId } = opts;
    setPending(true);
    setError(null);

    const result = await createInstantAlertsOrderAction(listingId, discountCode.trim() || undefined);
    if (!result.success) {
      setPending(false);
      setError(result.error);
      return;
    }

    const { order } = result;
    pushDataLayerEvent("begin_checkout_instant_alerts", {
      transactionId: order.paymentId,
      listingId,
      value: order.amount / 100,
      currency: order.currency,
    });

    try {
      await loadRazorpayScript();
      const razorpay = new window.Razorpay({
        key: order.razorpayKeyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.razorpayOrderId,
        name: "Bhavano",
        description: "Instant Alerts for this ad",
        handler: () => {
          setOpen(false);
          setPending(false);
          onActivatingRef.current?.();
          pushDataLayerEvent("instant_alerts_purchase", {
            transactionId: order.paymentId,
            listingId,
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
    <InstantAlertsContext.Provider value={{ getInstantAlerts }}>
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
            <div className="font-lora font-bold text-[17px] text-text mb-1">Get Instant Alerts</div>
            <p className="text-[13px] text-muted mb-4 m-0">
              We&rsquo;ll email you (or WhatsApp you) the moment a buyer messages you or shows interest in this ad — no need to keep
              checking the app. Valid until this ad expires.
            </p>
            <label className="block text-[11.5px] font-bold text-muted mb-1.5">Discount code (optional)</label>
            <input
              value={discountCode}
              onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
              placeholder="e.g. LAUNCH25"
              className="w-full border-[1.5px] border-border rounded-[10px] px-3 py-2.5 text-sm text-text bg-surface mb-4"
            />
            <button
              onClick={onConfirm}
              disabled={pending}
              className="w-full bg-green text-on-green border-0 rounded-lg py-3 text-sm font-extrabold cursor-pointer disabled:opacity-60"
            >
              {pending ? "Opening checkout…" : `Get Instant Alerts — ₹${priceSettings.instantAlertsPrice}`}
            </button>
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
    </InstantAlertsContext.Provider>
  );
}
