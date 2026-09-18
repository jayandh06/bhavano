"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { BoostPricingPreviewDto, ListingCategory } from "@bhavano/types";
import { useBoost } from "./BoostProvider";
import { useInstantAlerts } from "./InstantAlertsProvider";

/**
 * Deep-links straight into the Boost/Instant Alerts dialog when landing here from the mobile
 * app's iOS in-app browser (BoostButton.tsx/InstantAlertsButton.tsx/PostAdWizard.tsx there open
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
  const { getInstantAlerts } = useInstantAlerts();
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    const openBoostId = searchParams.get("openBoost");
    const openInstantAlertsId = searchParams.get("openInstantAlerts");
    if (!openBoostId && !openInstantAlertsId) return;
    firedRef.current = true;

    if (openBoostId) {
      const listing = listings.find((l) => l.id === openBoostId);
      // `withAlerts=1` opens the same screen with Instant Alerts already ticked — what the
      // promotion email's "Boost my ad + Instant Alerts" button asks for, so the seller sees the
      // combined price they clicked rather than having to find the checkbox.
      if (listing)
        boost({
          listingId: listing.id,
          category: listing.category,
          withInstantAlerts: searchParams.get("withAlerts") === "1",
          initialPricing,
        });
    }
    if (openInstantAlertsId) {
      getInstantAlerts({ listingId: openInstantAlertsId });
    }

    const params = new URLSearchParams(searchParams.toString());
    params.delete("openBoost");
    params.delete("openInstantAlerts");
    params.delete("withAlerts");
    router.replace(params.toString() ? `/my-listings?${params.toString()}` : "/my-listings");
    // Only ever meant to fire once, off whatever the URL was on first paint — re-running this on
    // every searchParams/listings identity change would refight the router.replace above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
