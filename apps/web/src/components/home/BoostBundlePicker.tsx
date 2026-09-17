"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { BoostPricingPreviewDto, ListingCategory } from "@bhavano/types";
import type { BoostDurationDays } from "@bhavano/types/boostPricing";
import { createBoostBundleOrderAction, previewBoostPricingAction } from "@/app/actions/payments";
import { loadRazorpayScript } from "@/lib/razorpay";
import { pushDataLayerEvent } from "@/lib/gtm";
import { Icon } from "./Icon";

const BOOST_DURATIONS: BoostDurationDays[] = [7, 15];

/** Replaces the old side-by-side Boost/Instant Alerts buttons on the post-ad success screen —
 * those only ever showed a price after being clicked (each opened its own modal that fetched
 * pricing on open), and treated the two as fully separate purchases even for a seller who wanted
 * both. This fetches every combination's price up front (via PaymentsService.previewBoostPricing,
 * which also auto-applies the current promo code and the Agent Pro free-credit check) and, when
 * Instant Alerts is added, checks out as a single combined Razorpay payment
 * (createBoostOrder's `includeInstantAlerts`) rather than two payments back to back. */
export function BoostBundlePicker({
  listingId,
  category,
  onActivating,
  defaultAddInstantAlerts = false,
}: {
  listingId: string;
  category: ListingCategory;
  /** Pre-ticks "Add Instant Alerts". Set when the seller arrived by choosing that specifically —
   * the Boost + Instant Alerts button in the admin-sent promotion email lands here with it on,
   * so the screen already reflects what they clicked. */
  defaultAddInstantAlerts?: boolean;
  /** Fired once the purchase is either activated for free (Pro credit) or paid for — the
   * success screen swaps this picker for a "Boost pending…" style state while the webhook
   * catches up, same contract BoostButton/BoostProvider already use elsewhere. */
  onActivating?: () => void;
}) {
  const router = useRouter();
  const [pricing, setPricing] = useState<BoostPricingPreviewDto | null>(null);
  const [duration, setDuration] = useState<BoostDurationDays>(7);
  const [addInstantAlerts, setAddInstantAlerts] = useState(defaultAddInstantAlerts);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    previewBoostPricingAction(category).then((result) => {
      if (!cancelled && result.success) setPricing(result.pricing);
    });
    return () => {
      cancelled = true;
    };
  }, [category]);

  const optionKey =
    duration === 7
      ? addInstantAlerts
        ? "boost7WithInstantAlerts"
        : "boost7"
      : addInstantAlerts
        ? "boost15WithInstantAlerts"
        : "boost15";
  const option = pricing?.[optionKey];

  async function onPay() {
    setPending(true);
    setError(null);

    const result = await createBoostBundleOrderAction(listingId, duration, addInstantAlerts);
    if (!result.success) {
      setPending(false);
      setError(result.error);
      return;
    }

    if (result.order.activated) {
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
      boostDays: duration,
      includeInstantAlerts: addInstantAlerts,
      value: order.amount / 100,
      currency: order.currency,
    });

    try {
      await loadRazorpayScript();
      const razorpay = new window.Razorpay({
        // Both non-null by the guard above — same pattern BoostProvider uses.
        key: order.razorpayKeyId!,
        amount: order.amount,
        currency: order.currency,
        order_id: order.razorpayOrderId!,
        name: "Bhavano",
        description: `Boost this ad for ${duration} days${addInstantAlerts ? " + Instant Alerts" : ""}`,
        handler: () => {
          setPending(false);
          onActivating?.();
          pushDataLayerEvent("boost_purchase", {
            transactionId: order.paymentId,
            listingId,
            category,
            boostDays: duration,
            includeInstantAlerts: addInstantAlerts,
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
    <div className="w-full rounded-2xl border border-[color:var(--gold)]/40 bg-surface-alt/60 p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon name="boost" className="text-[color:var(--gold)] text-lg" />
        <span className="font-lora font-bold text-[15px] text-text">Reach more buyers, faster</span>
      </div>
      <ul className="flex flex-col gap-2 m-0 p-0 list-none mb-4">
        {(
          [
            ["featured", "A gold Featured badge, ranked above regular listings"],
            ["bell", "Add Instant Alerts to get emailed the moment someone messages you"],
          ] as const
        ).map(([icon, text]) => (
          <li key={text} className="flex items-start gap-2 text-[13px] text-text-soft">
            <Icon name={icon} className="text-green mt-[3px] shrink-0" />
            <span>{text}</span>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2.5">
        {BOOST_DURATIONS.map((days) => (
          <button
            key={days}
            type="button"
            onClick={() => setDuration(days)}
            disabled={pending}
            className={`flex justify-between items-center border-[1.5px] rounded-[10px] px-4 py-3 text-sm font-bold cursor-pointer disabled:opacity-50 ${
              duration === days ? "border-green bg-green/10 text-text" : "border-border bg-surface-alt text-text"
            }`}
          >
            <span>Boost {days} days</span>
            <PriceTag
              option={pricing ? (days === 7 ? pricing.boost7 : pricing.boost15) : undefined}
            />
          </button>
        ))}

        <label className="flex items-center justify-between gap-2 border-[1.5px] border-border rounded-[10px] px-4 py-3 text-sm font-bold text-text cursor-pointer bg-surface-alt">
          <span className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={addInstantAlerts}
              disabled={pending}
              onChange={(e) => setAddInstantAlerts(e.target.checked)}
            />
            Add Instant Alerts
          </span>
          {pricing && (
            <span className="text-[13px] text-muted font-normal">
              +₹
              {duration === 7
                ? pricing.boost7WithInstantAlerts.amount - pricing.boost7.amount
                : pricing.boost15WithInstantAlerts.amount - pricing.boost15.amount}
            </span>
          )}
        </label>
      </div>

      {error && <p className="text-[#b3413a] text-[13px] mt-3 mb-0">{error}</p>}

      <button
        onClick={onPay}
        disabled={pending || !option}
        className="mt-4 w-full inline-flex items-center justify-center gap-2 bg-green text-on-green border-0 rounded-lg px-4 py-3 text-sm font-bold cursor-pointer shadow-[0_1px_4px_rgba(0,0,0,0.18)] disabled:opacity-60"
      >
        {pending ? "Opening checkout…" : option?.free ? "Activate for free" : <>Pay <PriceTag option={option} bold /></>}
      </button>
    </div>
  );
}

function PriceTag({ option, bold }: { option: { amount: number; originalAmount: number; discountApplied: boolean; free: boolean } | undefined; bold?: boolean }) {
  if (!option) return <span className="text-muted">…</span>;
  if (option.free) return <span className="text-green">Free</span>;
  return (
    <span className={bold ? "text-on-green" : "text-green"}>
      {option.discountApplied && (
        <span className={`line-through mr-1.5 ${bold ? "text-on-green/70" : "text-muted"}`}>₹{option.originalAmount}</span>
      )}
      ₹{option.amount}
    </span>
  );
}
