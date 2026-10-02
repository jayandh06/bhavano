"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { BoostPricingPreviewDto, ListingCategory } from "@bhavano/types";
import {
  boostOptionFor,
  boostSavings,
  defaultBoostDuration,
  offeredBoostDurations,
  type BoostDurationDays,
} from "@bhavano/types/boostPricing";
import { discountPercentFor } from "@bhavano/types/promoCode";
import type { PurchaseSource } from "@bhavano/types/purchaseSource";
import { previewBoostPricingAction, redeemReferralBoostAction } from "@/app/actions/payments";
import { startBoostCheckout } from "@/lib/boostCheckout";
import { Icon } from "./Icon";

/** The Boost picker on the post-ad success screen and My Listings. Fetches every duration's price
 * up front (via PaymentsService.previewBoostPricing, which also auto-applies the current promo code
 * and the Agent Pro free-credit check) and shows what each longer option saves against the 7-day
 * price. Instant Alerts is included in every boost at no extra charge, so there is no separate
 * choice to make. */
export function BoostBundlePicker({
  listingId,
  category,
  onActivating,
  initialPricing,
  source,
}: {
  listingId: string;
  category: ListingCategory;
  /** Where this checkout was started from, recorded on the payment. */
  source?: PurchaseSource;
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
  // The middle option is pre-selected: a 7-day default was taken by 13 of 19 buyers, and the longer
  // options are cheaper per day.
  const [duration, setDuration] = useState<BoostDurationDays>(15);
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

  const offered = offeredBoostDurations(pricing);
  // A duration admin has switched off falls back to the default rather than staying selected.
  const effectiveDuration = offered.includes(duration) ? duration : defaultBoostDuration(offered);
  const option = pricing ? boostOptionFor(pricing, effectiveDuration) : undefined;

  async function onPay() {
    setPending(true);
    setError(null);

    const result = await startBoostCheckout({
      listingId,
      category,
      duration: effectiveDuration,
      includeInstantAlerts: true,
      source,
    });
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

  async function onUseFreeBoost() {
    setPending(true);
    setError(null);
    const result = await redeemReferralBoostAction(listingId, source);
    setPending(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    onActivating?.();
    setTimeout(() => router.refresh(), 1500);
  }

  const referralCredit = pricing?.referralCredit ?? null;

  // Admin has moved this offer onto the ad-preview step instead — see
  // docs/plans/boost-instant-alerts-preview-selector.md. The two placements are mutually
  // exclusive, so this post-creation picker stays hidden entirely rather than duplicating the
  // offer.
  // A free referral boost is still offered here — the preview-step selector can't spend one.
  const paidOptionsHidden = !!pricing?.showSelectorOnPreview;
  if (paidOptionsHidden && !referralCredit) return null;

  const freeBoostBlock = referralCredit && (
    <div className="mb-4 rounded-[10px] border-[1.5px] border-green bg-green/10 p-3.5 flex flex-col gap-2.5">
      <div className="text-[13.5px] text-text">
        <span className="font-bold">
          You have {referralCredit.available === 1 ? "a free boost" : `${referralCredit.available} free boosts`}
        </span>{" "}
        from referring friends. Use one now for {referralCredit.days} days, free.{" "}
        <span className="text-muted" suppressHydrationWarning>
          Expires {new Date(referralCredit.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}.
        </span>
      </div>
      <button
        type="button"
        onClick={onUseFreeBoost}
        disabled={pending}
        className="w-full bg-green text-on-green border-0 rounded-lg px-4 py-2.5 text-sm font-bold cursor-pointer disabled:opacity-60"
      >
        {pending ? "Activating…" : `Use free ${referralCredit.days}-day boost`}
      </button>
      {!paidOptionsHidden && <div className="text-[12px] text-muted text-center">or pay for a longer boost below</div>}
    </div>
  );

  if (paidOptionsHidden) {
    return (
      <div className="w-full">
        {freeBoostBlock}
        {error && <p className="text-[#b3413a] text-[13px] mt-0 mb-0">{error}</p>}
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl border border-[color:var(--gold)]/40 bg-surface-alt/60 p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon name="boost" className="text-[color:var(--gold)] text-lg" />
        <span className="font-lora font-bold text-[15px] text-text">
          Reach more buyers, faster
          {/* Computed from the option's own amount/originalAmount rather than hardcoded — the
            * real percent lives on an admin-edited DiscountCode row, so this can't go stale. */}
          {option?.discountApplied && (
            <span className="text-[color:var(--gold)]"> — {discountPercentFor(option.amount, option.originalAmount)}% OFF</span>
          )}
        </span>
      </div>
      <ul className="flex flex-col gap-2 m-0 p-0 list-none mb-4">
        {(
          [
            ["featured", "A gold Featured badge, ranked above regular listings"],
            ["bell", "Instant Alerts included: get emailed and WhatsApp'd the moment someone messages or shows interest"],
          ] as const
        ).map(([icon, text]) => (
          <li key={text} className="flex items-start gap-2 text-[13px] text-text-soft">
            <Icon name={icon} className="text-green mt-[3px] shrink-0" />
            <span>{text}</span>
          </li>
        ))}
      </ul>

      {freeBoostBlock}

      <div className="flex flex-col gap-2.5">
        {offered.map((days) => {
          const opt = pricing ? boostOptionFor(pricing, days) : undefined;
          // Quoted against the 7-day price, so only while that option is on screen too.
          const saving = pricing && days !== 7 && offered.includes(7) ? boostSavings(pricing, days) : null;
          return (
            <button
              key={days}
              type="button"
              onClick={() => setDuration(days)}
              disabled={pending}
              className={`flex justify-between items-center gap-3 border-[1.5px] rounded-[10px] px-4 py-3 text-sm font-bold cursor-pointer disabled:opacity-50 ${
                effectiveDuration === days ? "border-green bg-green/10 text-text" : "border-border bg-surface-alt text-text"
              }`}
            >
              <span className="flex flex-col items-start gap-0.5 text-left">
                <span className="flex items-center gap-2">
                  Boost {days} days
                  {days === 30 && saving && (
                    <span className="text-[10.5px] font-bold text-on-green bg-green rounded-md px-1.5 py-[1px]">
                      Best value
                    </span>
                  )}
                </span>
                {saving ? (
                  <span className="text-[12px] font-normal text-green">
                    ₹{saving.perDay}/day · save ₹{saving.rupees} ({saving.percent}%) vs the 7-day price
                  </span>
                ) : (
                  opt &&
                  !opt.free && <span className="text-[12px] font-normal text-muted">₹{Math.round(opt.amount / days)}/day</span>
                )}
              </span>
              <PriceTag option={opt} />
            </button>
          );
        })}
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
