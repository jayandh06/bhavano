"use client";

import { useEffect } from "react";

/** Both windows agree on this string; `AuthGateProvider` ignores a message carrying anything else. */
export const AUTH_POPUP_MESSAGE = "bhavano:auth-complete";

/**
 * The last page the popup loads. Tells the window that opened it what happened, then closes.
 *
 * `ok` comes from the server having actually resolved a session, not from merely arriving here —
 * landing on this URL is not proof of anything, and the opener uses the answer to decide whether
 * to show "logged in" or leave the dialog up.
 *
 * The no-opener branch is the one that matters in practice. A blocked popup, a browser that
 * turned it into an ordinary tab, or someone opening this URL directly all end up here with
 * nothing to talk to — and a page whose whole job is to close itself would otherwise be a dead
 * end. Those cases navigate on instead, which is exactly the full-page behaviour this flow
 * replaces, so the worst outcome is the experience everyone had before.
 */
export function AuthPopupComplete({ ok }: { ok: boolean }) {
  useEffect(() => {
    const opener = window.opener as Window | null;
    if (opener && !opener.closed) {
      // Targeted at our own origin rather than "*": the message says a login succeeded, and
      // whatever else may be listening has no business being told.
      opener.postMessage({ type: AUTH_POPUP_MESSAGE, ok }, window.location.origin);
      window.close();
      return;
    }
    window.location.replace("/");
  }, [ok]);

  return (
    <div className="min-h-dvh flex items-center justify-center bg-bg text-text p-6">
      <p className="text-sm text-muted">
        {ok ? "Signed in — you can close this window." : "Sign-in was not completed."}
      </p>
    </div>
  );
}
