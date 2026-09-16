"use client";

import { useEffect } from "react";

/** Marks this browsing session as one where JavaScript actually ran — see `Visit.jsConfirmedAt`.
 *
 * Renders nothing, holds no state, and is the smallest possible leaf: mounting it in the root
 * layout adds a client boundary around an empty component, not around any page content, so
 * nothing moves out of the server-rendered output and crawlers see exactly what they saw before.
 *
 * Why it's worth a request at all: every other human/bot signal this app has is a header the
 * client chooses for itself. `isBot` is a substring match on the User-Agent, so a scraper
 * announcing itself as Safari passes it — measured, on datacentre hosts logging as
 * `deviceType: mobile`. Running a JavaScript engine is a capability rather than a claim, and most
 * scripted clients don't. Nothing is fingerprinted here: no `navigator.webdriver`, no canvas, no
 * device details. The signal *is* the request, which is also why it collects nothing new and
 * needs no privacy disclosure beyond what /privacy already says about the session cookie.
 *
 * Once per session, remembered in `sessionStorage` (not `localStorage`: the session cookie it
 * corresponds to dies with the browser, so the memory should too). Wrapped in try/catch because
 * Safari's private mode throws on access rather than returning null — and a throw here would
 * break nothing visible, but it would silently stop the beacon firing for every private-mode
 * visitor. */
const STORAGE_KEY = "bhavano_js_confirmed";

export function JsConfirmation() {
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(STORAGE_KEY) === "1") return;
    } catch {
      // Storage unavailable — fall through and send it. A duplicate is harmless: the BFF keeps
      // the first confirmation (COALESCE) and the whole call is idempotent.
    }

    void fetch("/api/analytics/confirm", { method: "POST", keepalive: true })
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
