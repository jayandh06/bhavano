"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { pushDataLayerEvent } from "@/lib/gtm";

/** Fires a one-time GTM conversion event when a listing's detail page is reached right after
 * a successful post (`?posted=true` on the post-create redirect — see createListingAction).
 * Renders nothing. */
export function PostSuccessTracker({ listingId }: { listingId: string }) {
  const searchParams = useSearchParams();
  const posted = searchParams.get("posted") === "true";

  useEffect(() => {
    if (posted) pushDataLayerEvent("post_ad_success", { listingId });
    // Only fire once per mount, regardless of listingId identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posted]);

  return null;
}
