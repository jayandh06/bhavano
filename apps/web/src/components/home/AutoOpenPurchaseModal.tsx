"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { BoostPricingPreviewDto, ListingCategory } from "@bhavano/types";
import { PURCHASE_SOURCE_PARAM, parsePurchaseSource } from "@bhavano/types/purchaseSource";
import { useBoost } from "./BoostProvider";

/**
 * Deep-links straight into the Boost/Instant Alerts dialog when landing here from the mobile
 * app's iOS in-app browser (BoostButton.tsx/PostAdWizard.tsx there open
 * `/my-listings?openBoost=<id>` or `?openInstantAlerts=<id>` instead of the bare path, since
 * Apple Guideline 3.1.1 means iOS can't open the native checkout itself) — without this, the
 * seller lands on the plain listings page and has to re-find the ad and tap the button again.
 *
 * `listings` is the same array the server component already fetched — boost() needs each
 * listing's category for price lookup, which this component has no way to fetch itself without
 * a second round trip. Strips the query param after firing so a later refresh/back-navigation
 * doesn't reopen the dialog.
 */
export function AutoOpenPurchaseModal({
  listings,
  initialPricing,
}: {
  listings: { id: string; category: ListingCategory }[];
  /** The deep-linked listing's price, already resolved by the page's own server render (see
   * my-listings/page.tsx). Handed to the dialog so it opens with a price instead of fetching one
   * — which is what broke arriving from an emailed link: the fetch raced a session that had only
   * just been established, and a dialog with no price is the one thing this flow cannot afford. */
  initialPricing?: BoostPricingPreviewDto;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { boost } = useBoost();
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    // `openInstantAlerts` is an old link (Instant Alerts used to be sold on its own). Instant Alerts
    // now comes with every boost, so an old link opens the Boost screen for that ad instead, and
    // `withAlerts` is simply ignored.
    const openBoostId = searchParams.get("openBoost") ?? searchParams.get("openInstantAlerts");
    if (!openBoostId) return;
    firedRef.current = true;

    const listing = listings.find((l) => l.id === openBoostId);
    const source = parsePurchaseSource(searchParams.get(PURCHASE_SOURCE_PARAM));
    if (listing) boost({ listingId: listing.id, category: listing.category, initialPricing, source });

    const params = new URLSearchParams(searchParams.toString());
    params.delete("openBoost");
    params.delete(PURCHASE_SOURCE_PARAM);
    params.delete("openInstantAlerts");
    params.delete("withAlerts");
    router.replace(params.toString() ? `/my-listings?${params.toString()}` : "/my-listings");
    // Only ever meant to fire once, off whatever the URL was on first paint — re-running this on
    // every searchParams/listings identity change would refight the router.replace above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
