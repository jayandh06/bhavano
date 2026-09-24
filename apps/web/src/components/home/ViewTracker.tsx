"use client";

import { useEffect } from "react";
import { recordInterestAction, trackViewAction } from "@/app/actions/listings";

const STORAGE_KEY = "bhavano.viewerKey";
// Mirrors the localStorage value into a cookie of the same name (see lib/bff.ts's
// VIEWER_KEY_COOKIE) purely so a server action/NextAuth callback can read it at login time to
// link this visitor's pre-signup ListingView rows to their new account — localStorage itself
// isn't visible to server-side code. Six months, refreshed on every view (unlike localStorage,
// which never expires on its own) — an active visitor's cookie never lapses; only someone who
// stays away for 6+ months loses the link-at-signup ability, not their view-tracking itself.
const VIEWER_KEY_COOKIE = "bhavano_vk";
const VIEWER_KEY_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 182;

function getOrCreateViewerKey(): string {
  let key = localStorage.getItem(STORAGE_KEY);
  if (!key) {
    key = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, key);
  }
  // Re-set on every call (not just when missing) so an active visitor's cookie keeps rolling
  // forward instead of silently expiring 6 months after their first-ever view.
  document.cookie = `${VIEWER_KEY_COOKIE}=${key}; path=/; max-age=${VIEWER_KEY_COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
  return key;
}

/**
 * Fires once per mount: always records a ListingView; when the viewer is logged in and not the
 * owner, also upserts ListingInterest (99acres-style auto intent notify).
 * See docs/plans/login-gated-listing-interest-owner-notify.md.
 */
export function ViewTracker({
  listingId,
  recordInterest = false,
}: {
  listingId: string;
  /** True when the page was rendered for a logged-in non-owner. */
  recordInterest?: boolean;
}) {
  useEffect(() => {
    void trackViewAction(listingId, getOrCreateViewerKey());
    if (recordInterest) {
      void recordInterestAction(listingId);
    }
    // Only track once per page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
