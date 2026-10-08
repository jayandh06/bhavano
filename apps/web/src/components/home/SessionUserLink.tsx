"use client";

import { useEffect } from "react";

/**
 * Tells the server which user (if any) this browser session belongs to — see
 * `/api/analytics/link-session`'s own doc comment for why web needed this and mobile already
 * had it.
 *
 * Smallest possible leaf, same reasoning as `JsConfirmation`: mounting it in the root layout
 * adds a client boundary around an empty component, not around any page content, so nothing
 * moves out of the server-rendered output.
 *
 * Once per session, remembered in `sessionStorage` — the route handler no-ops instantly for a
 * logged-out visitor or a missing session cookie, so firing it unconditionally costs nothing on
 * the common path; this just avoids repeating the round trip on every navigation. Wrapped in
 * try/catch because Safari's private mode throws on storage access rather than returning null.
 */
const STORAGE_KEY = "bhavano_session_linked";

export function SessionUserLink() {
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(STORAGE_KEY) === "1") return;
    } catch {
      // Storage unavailable — fall through and send it. The BFF call is idempotent either way
      // (linkVisitToUser only ever fills an empty userId), so a duplicate is harmless.
    }

    void fetch("/api/analytics/link-session", { method: "POST", keepalive: true })
      .then(() => {
        try {
          window.sessionStorage.setItem(STORAGE_KEY, "1");
        } catch {
          // Same as above: worst case this fires once more on the next navigation.
        }
      })
      .catch(() => {
        // Offline, or the visitor navigated away mid-flight. Not worth retrying.
      });
  }, []);

  return null;
}
