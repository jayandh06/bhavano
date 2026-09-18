"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { BoostPricingPreviewDto, ListingCategory } from "@bhavano/types";
import { BoostBundlePicker } from "./BoostBundlePicker";

/**
 * One shared "boost this ad" screen for the whole app. Each `BoostButton` used to inline its own
 * copy of a modal + Razorpay wiring; on a list of listings that's N of them, only one reachable at
 * a time purely because its full-screen scrim blocked the other buttons. This is the single
 * instance at layout level — `BoostButton` keeps only its own "Boost pending…" pill.
 *
 * The modal's contents are `BoostBundlePicker`, the very component the post-ad success screen
 * shows. That is not a cosmetic tidy-up: this modal used to price boosts itself with
 * `boostPriceFor` and order with no discount code, while the post-ad picker previewed prices with
 * the active promo auto-applied — so **the same boost cost ₹199 from My Listings and ₹100 straight
 * after posting**, decided purely by which route the seller took. It also had no way to add Instant
 * Alerts, so the two products could only be bought as two separate payments from here.
 *
 * The boost activates on the BFF webhook, not the checkout callback, so success just means
 * "payment done" — the picker triggers a `router.refresh()` a few seconds later and calls
 * `onActivating` so the trigger can show its pending state.
 */

interface BoostOptions {
  listingId: string;
  category: ListingCategory;
  /** Fired when the boost is either activated for free (Pro credit) or paid for — the trigger
   * uses it to swap itself for a "Boost pending…" label while the webhook catches up. */
  onActivating?: () => void;
  /** Opens with "Add Instant Alerts" already ticked — used by the deep link the promotion email's
   * "Boost + Instant Alerts" button carries. */
  withInstantAlerts?: boolean;
  /** A price the caller already has, so the dialog does not have to fetch one. Only the deep-link
   * path supplies it (resolved in my-listings' own server render); an in-app click leaves it unset
   * and the dialog fetches as before, with a session that is long since warm. */
  initialPricing?: BoostPricingPreviewDto;
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
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<BoostOptions | null>(null);

  function boost(options: BoostOptions) {
    setOpts(options);
    setOpen(true);
  }

  return (
    <BoostContext.Provider value={{ boost }}>
      {children}

      {open && opts && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 bg-[var(--modal-scrim)] z-[110] flex items-center justify-center p-5"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-surface rounded-2xl w-[400px] max-w-full p-5 animate-[modalIn_0.2s_ease_both]"
          >
            <div className="font-lora font-bold text-[17px] text-text mb-3">Boost this ad</div>
            <BoostBundlePicker
              listingId={opts.listingId}
              category={opts.category}
              defaultAddInstantAlerts={opts.withInstantAlerts}
              initialPricing={opts.initialPricing}
              onActivating={() => {
                setOpen(false);
                opts.onActivating?.();
              }}
            />
            <button
              onClick={() => setOpen(false)}
              className="mt-3 w-full bg-transparent border-0 text-muted text-[13px] font-bold cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </BoostContext.Provider>
  );
}
