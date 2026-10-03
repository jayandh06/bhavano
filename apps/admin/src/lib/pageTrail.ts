/** Display form of a Page-visits trail entry.
 *
 * The web wizard writes `/post/error?stage=publish&reason=...` when Publish or checkout fails
 * (see reportPostError in the web PostAdWizard) — PageView stores only a path, so the reason rides
 * in the query string, percent-encoded. Shown decoded and flagged so an error reads as one at a
 * glance instead of as a page nobody visited.
 *
 * `/post/boost-recovery?event=...&trigger=...` is the same trick for the boost recovery dialog
 * (see reportBoostRecoveryEvent in the web PostAdWizard, docs/plans/boost-recovery-dialog.md) —
 * GTM/GA4 sees these separately via pushDataLayerEvent, but that never reaches this trail, which
 * only reads PageView rows.
 *
 * `/login-nudge?event=...&surface=...` is the same trick again, for the listing-detail login ask
 * (see reportLoginNudgeEvent in web's ListingLoginNudge.tsx) — shown/logged-in/dismissed for
 * either the dismissible card ("web_prompt") or Google One Tap ("one_tap"), the only way to see
 * whether an anonymous visitor who was pinged to log in actually did. */
export function trailEntry(path: string): { text: string; isError: boolean } {
  if (path.startsWith("/login-nudge")) {
    try {
      const params = new URL(path, "https://x.invalid").searchParams;
      const event = params.get("event") ?? "unknown";
      const surface = params.get("surface") === "one_tap" ? "One Tap" : "card";
      const label =
        event === "shown"
          ? `Login nudge shown (${surface})`
          : event === "login"
            ? `Login nudge — logged in (${surface})`
            : event === "dismissed"
              ? `Login nudge — dismissed (${surface})`
              : `Login nudge: ${event} (${surface})`;
      return { text: label, isError: false };
    } catch {
      return { text: path, isError: false };
    }
  }
  if (path.startsWith("/post/boost-recovery")) {
    try {
      const params = new URL(path, "https://x.invalid").searchParams;
      const event = params.get("event") ?? "unknown";
      const trigger = params.get("trigger");
      const label =
        event === "shown"
          ? `Boost recovery shown${trigger ? ` (${trigger === "idle" ? "60s idle" : "tapped Post ad"})` : ""}`
          : event === "accepted"
            ? "Boost recovery — added Boost"
            : event === "dismissed"
              ? "Boost recovery — skipped"
              : `Boost recovery: ${event}`;
      return { text: label, isError: false };
    } catch {
      return { text: path, isError: false };
    }
  }
  if (!path.startsWith("/post/error")) return { text: path, isError: false };
  try {
    const params = new URL(path, "https://x.invalid").searchParams;
    const stage = params.get("stage") ?? "unknown";
    const reason = params.get("reason") ?? "";
    return { text: `Error on ${stage}${reason ? ` — ${reason}` : ""}`, isError: true };
  } catch {
    return { text: path, isError: true };
  }
}

const SITE_URL = "https://www.bhavano.com";

/** The real page to open for a trail entry, or null for a `/login-nudge`/`/post/boost-recovery`/
 * `/post/error` marker (see trailEntry above) — those aren't pages anyone can visit, just an event
 * encoded as a path, so there's nothing to link to. */
export function trailEntryHref(path: string): string | null {
  if (path.startsWith("/login-nudge") || path.startsWith("/post/boost-recovery") || path.startsWith("/post/error")) {
    return null;
  }
  return `${SITE_URL}${path}`;
}
