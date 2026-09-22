"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { BoostPricingPreviewDto, ListingCategory } from "@bhavano/types";
import type { BoostDurationDays } from "@bhavano/types/boostPricing";
import { previewBoostPricingAction } from "@/app/actions/payments";
import { startBoostCheckout } from "@/lib/boostCheckout";
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
  initialPricing,
}: {
  listingId: string;
  category: ListingCategory;
  /** Pre-ticks "Add Instant Alerts". Set when the seller arrived by choosing that specifically —
   * the Boost + Instant Alerts button in the admin-sent promotion email lands here with it on,
   * so the screen already reflects what they clicked. */
  defaultAddInstantAlerts?: boolean;
  /** A price resolved before this mounted — the deep-link path passes the one its page's server
   * render produced. With it, there is no fetch, no retry ladder and no race with a
   * just-established session: the dialog opens showing the price. */
  initialPricing?: BoostPricingPreviewDto;
  /** Fired once the purchase is either activated for free (Pro credit) or paid for — the
   * success screen swaps this picker for a "Boost pending…" style state while the webhook
   * catches up, same contract BoostButton/BoostProvider already use elsewhere. */
  onActivating?: () => void;
}) {
  const router = useRouter();
  const [pricing, setPricing] = useState<BoostPricingPreviewDto | null>(initialPricing ?? null);
  const [duration, setDuration] = useState<BoostDurationDays>(7);
  const [addInstantAlerts, setAddInstantAlerts] = useState(defaultAddInstantAlerts);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Why the price could not be loaded — distinct from `error` (a checkout failure), because the
   * two need different offers of what to do next: retry the price, or retry the payment. */
  const [priceError, setPriceError] = useState<string | null>(null);
  // Ever-increasing, not a retry count — bumping it is what re-triggers the effect below, both
  // from its own backoff and from the focus listener further down.
  const [fetchKey, setFetchKey] = useState(0);
  const failuresRef = useRef(0);
  const MAX_PRICE_RETRIES = 5;

  // A single 1.2s retry used to cover "arriving from an emailed link while logged out, logging
  // in, and landing here" — but the session-settling delay this is working around isn't a fixed
  // beat: it varies with how the login happened (OTP entered inline vs. the Google OAuth popup,
  // which can take the visitor away from this tab for as long as they take to pick an account),
  // so one retry silently gave up on the slower cases and left the price stuck at "…" forever.
  // Backing off across several retries covers the slow-but-still-quick cases; the focus listener
  // below covers the popup case, where no timer here would ever fire while the tab is backgrounded.
  useEffect(() => {
    // Nothing to fetch when the page already handed us one.
    if (initialPricing) return;

    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;

    previewBoostPricingAction(category).then((result) => {
      if (cancelled) return;
      if (result.success) {
        setPricing(result.pricing);
        setPriceError(null);
        failuresRef.current = 0;
        return;
      }
      failuresRef.current += 1;
      if (failuresRef.current <= MAX_PRICE_RETRIES) {
        retry = setTimeout(() => setFetchKey((k) => k + 1), 1000 * failuresRef.current);
        return;
      }
      setPriceError(result.error);
    });

    return () => {
      cancelled = true;
      if (retry) clearTimeout(retry);
    };
  }, [category, fetchKey, initialPricing]);

  // Logging in via the Google OAuth popup steals focus for the whole flow, so by the time the
  // visitor is back on this tab the backoff above may have already exhausted its retries (or the
  // tab was backgrounded long enough for its timers to be throttled well past their delay).
  // Regaining focus without a price yet is as reliable a "something may have changed" signal as
  // this component can get without wiring a session-change event into it.
  useEffect(() => {
    function onFocus() {
      if (pricing) return;
      failuresRef.current = 0;
      setPriceError(null);
      setFetchKey((k) => k + 1);
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [pricing]);

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

    const result = await startBoostCheckout({ listingId, category, duration, includeInstantAlerts: addInstantAlerts });
    setPending(false);

    if (result.outcome === "activated") {
      onActivating?.();
      setTimeout(() => router.refresh(), 1500);
    } else if (result.outcome === "paid") {
      onActivating?.();
      setTimeout(() => router.refresh(), 4000);
    } else if (result.outcome === "error") {
      setError(result.message);
    }
    // "cancelled" — no error shown, just re-enable the button, same as before.
  }

  // Admin has moved this offer onto the ad-preview step instead — see
  // docs/plans/boost-instant-alerts-preview-selector.md. The two placements are mutually
  // exclusive, so this post-creation picker stays hidden entirely rather than duplicating the
  // offer.
  if (pricing?.showSelectorOnPreview) return null;

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

      {priceError && (
        <p className="text-[13px] text-muted mt-3 mb-0">
          Couldn&apos;t load the price.{" "}
          <button
            onClick={() => {
              failuresRef.current = 0;
              setPriceError(null);
              setFetchKey((k) => k + 1);
            }}
            className="bg-transparent border-0 p-0 text-[13px] font-bold text-green underline cursor-pointer"
          >
            Retry
          </button>
        </p>
      )}

      {/* Only `pending` disables this. It used to also require `option`, which meant a price that
        * failed to load (see the effect above) left the one button on the screen dead — even
        * though paying needs no price: the amount comes from the order the BFF creates. */}
      <button
        onClick={onPay}
        disabled={pending}
        className="mt-4 w-full inline-flex items-center justify-center gap-2 bg-green text-on-green border-0 rounded-lg px-4 py-3 text-sm font-bold cursor-pointer shadow-[0_1px_4px_rgba(0,0,0,0.18)] disabled:opacity-60"
      >
        {pending ? (
          "Opening checkout…"
        ) : option?.free ? (
          "Activate for free"
        ) : option ? (
          <>
            Pay <PriceTag option={option} bold />
          </>
        ) : (
          // No price yet: say so rather than showing a bare "Pay" beside an empty space, which
          // reads as broken.
          "Continue to payment"
        )}
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
