"use client";

import { useEffect } from "react";
import { trackViewAction } from "@/app/actions/listings";

const STORAGE_KEY = "bhavano.viewerKey";

function getOrCreateViewerKey(): string {
  let key = localStorage.getItem(STORAGE_KEY);
  if (!key) {
    key = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, key);
  }
  return key;
}

/** Fires once per mount to record a (deduped) view of this listing. Renders nothing. */
export function ViewTracker({ listingId }: { listingId: string }) {
  useEffect(() => {
    trackViewAction(listingId, getOrCreateViewerKey());
    // Only track once per page load, regardless of listingId identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
