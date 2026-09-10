"use client";

import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { createContactRevealCreditsOrderAction } from "@/app/actions/payments";
import { loadRazorpayScript } from "@/lib/razorpay";
import { pushDataLayerEvent } from "@/lib/gtm";

/**
 * One shared "buy contact-reveal credits" modal for the whole app — see
 * docs/plans/… discussion. Every `ListingCard` / `ListingDetailActions` used to inline its own
 * copy of this dialog + Razorpay wiring, so a grid of cards carried N of them: two could be
 * open at once (stacked scrims, each with its own discount-code state), and "centered" was only
 * viewport-centered while no card ancestor had a transform. This is the single instance,
 * rendered at layout level.
 */

interface BuyCreditsOptions {
  creditPackSize?: number;
  creditPackPriceRupees?: number;
  listingId?: string;
  /** Called once Razorpay checkout reports success. The credit batch is granted by the webhook,
   * not this callback, so callers still wait a few seconds before retrying whatever needed the
   * credit. */
  onPurchased?: () => void;
}

interface BuyCreditsContextValue {
  buyCredits: (options: BuyCreditsOptions) => void;
}

const BuyCreditsContext = createContext<BuyCreditsContextValue | null>(null);

export function useBuyCredits(): BuyCreditsContextValue {
  const ctx = useContext(BuyCreditsContext);
  if (!ctx) throw new Error("useBuyCredits must be used within BuyCreditsProvider");
  return ctx;
}

export function BuyCreditsProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<BuyCreditsOptions>({});
  const [discountCode, setDiscountCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onPurchasedRef = useRef<(() => void) | undefined>(undefined);

  function buyCredits(options: BuyCreditsOptions) {
    onPurchasedRef.current = options.onPurchased;
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
    setPending(true);
    setError(null);

    const result = await createContactRevealCreditsOrderAction(discountCode.trim() || undefined);
    if (!result.success) {
      setPending(false);
      setError(result.error);
      return;
    }

    const { order } = result;
    pushDataLayerEvent("begin_checkout_contact_reveal_credits", {
      transactionId: order.paymentId,
      ...(opts.listingId ? { listingId: opts.listingId } : {}),
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
        description: "Contact reveal credits",
        handler: () => {
          pushDataLayerEvent("contact_reveal_credits_purchase", {
            transactionId: order.paymentId,
            ...(opts.listingId ? { listingId: opts.listingId } : {}),
            value: order.amount / 100,
            currency: order.currency,
          });
          setPending(false);
          setOpen(false);
          onPurchasedRef.current?.();
        },
        modal: { ondismiss: () => setPending(false) },
      });
      razorpay.open();
    } catch {
      setPending(false);
      setError("Couldn't open checkout — please try again.");
    }
  }

  const packSize = opts.creditPackSize ?? 5;
  const packPrice = opts.creditPackPriceRupees ?? 125;

  return (
    <BuyCreditsContext.Provider value={{ buyCredits }}>
      {children}

      {open && (
        <div
          onClick={close}
          className="fixed inset-0 bg-[var(--modal-scrim)] z-[110] flex items-center justify-center p-5"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-surface rounded-2xl w-[360px] max-w-full p-6 animate-[modalIn_0.2s_ease_both]"
          >
            <div className="font-lora font-bold text-[17px] text-text mb-1">Buy contact-reveal credits</div>
            <p className="text-[13px] text-muted mb-4 m-0">
              You&rsquo;ve used your free reveals. {packSize} credits for ₹{packPrice} — each credit unlocks one
              listing&rsquo;s contact, permanently.
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
              {pending ? "Opening checkout…" : `Buy ${packSize} credits — ₹${packPrice}`}
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
    </BuyCreditsContext.Provider>
  );
}
