"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ListingCategory } from "@bhavano/types";
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
}: {
  listings: { id: string; category: ListingCategory }[];
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
      if (listing) boost({ listingId: listing.id, category: listing.category });
    }
    if (openInstantAlertsId) {
      getInstantAlerts({ listingId: openInstantAlertsId });
    }

    const params = new URLSearchParams(searchParams.toString());
    params.delete("openBoost");
    params.delete("openInstantAlerts");
    router.replace(params.toString() ? `/my-listings?${params.toString()}` : "/my-listings");
    // Only ever meant to fire once, off whatever the URL was on first paint — re-running this on
    // every searchParams/listings identity change would refight the router.replace above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
