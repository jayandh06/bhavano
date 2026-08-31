"use client";

import { useEffect, useRef } from "react";
import { pushDataLayerEvent } from "@/lib/gtm";

/**
 * Records who arrives at /post and whether they were already signed in.
 *
 * The page fires exactly one event today — `post_ad_success`, at the very end — so "many people
 * open /post and never post" is a reasonable hunch that the analytics cannot actually confirm,
 * and any change made to fix it would be equally unmeasurable. This is the denominator: how many
 * arrivals, and how many of them met the login wall rather than the form.
 *
 * Deployed ahead of any behaviour change on purpose, so there is a real before to compare an
 * after against.
 *
 * The ref, not an empty dep array alone: React runs effects twice in development's strict mode,
 * and a doubled arrival would quietly halve every conversion rate computed from it.
 */
export function PostPageTracker({ loggedIn }: { loggedIn: boolean }) {
  const sentRef = useRef(false);

  useEffect(() => {
    if (sentRef.current) return;
    sentRef.current = true;
    pushDataLayerEvent("post_page_view", { loggedIn });
  }, [loggedIn]);

  return null;
}
