"use client";

import { useEffect } from "react";

/** Both windows agree on this string; the opener ignores a message carrying anything else. Admin
 * and the consumer site are separate origins with separate popups, so there is no collision risk
 * in reusing the same literal — a listener only ever hears messages targeted at its own origin. */
export const AUTH_POPUP_MESSAGE = "bhavano-admin:auth-complete";

export type AuthPopupResult =
  | { ok: true }
  /** Google auth itself can succeed for anyone with a Google account — admin access is a
   * separate, BFF-assigned role, not something OAuth knows about. `reason` lets the opener show
   * the exact copy `requireAdmin`'s own redirect already uses for this case, instead of a generic
   * failure that would make a rejected account think something broke. */
  | { ok: false; reason: "unauthorized" | "failed" };

/**
 * The last page the popup loads. Reports what happened to the window that opened it, then closes.
 *
 * See the consumer site's identical component (apps/web/src/components/home/AuthPopupComplete.tsx)
 * for the full reasoning — this mirrors it exactly, duplicated rather than shared because admin
 * and web are separate Next.js apps with no shared runtime code between them.
 */
export function AuthPopupComplete({ result }: { result: AuthPopupResult }) {
  useEffect(() => {
    const opener = window.opener as Window | null;
    if (opener && !opener.closed) {
      opener.postMessage({ type: AUTH_POPUP_MESSAGE, ...result }, window.location.origin);
      window.close();
      return;
    }
    // No opener to tell — a blocked popup, or this URL opened directly. Falls through to the
    // ordinary full-page behaviour rather than leaving a dead end.
    window.location.replace(result.ok ? "/" : "/login?error=unauthorized");
  }, [result]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <p style={{ fontSize: 13, color: "var(--muted)" }}>
        {result.ok
          ? "Signed in — you can close this window."
          : result.reason === "unauthorized"
            ? "That account doesn't have admin access."
            : "Sign-in was not completed."}
      </p>
    </div>
  );
}
