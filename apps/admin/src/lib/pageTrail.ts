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
 * whether an anonymous visitor who was pinged to log in actually did.
 *
 * `/get-app?event=click|dismiss&placement=…&to=…` is web's get-the-app controls (reportGetAppEvent,
 * docs/plans/drive-users-to-android-app.md); `/app-install?source=…&medium=…&campaign=…` is the
 * mobile app's first launch after a fresh install, carrying the Play install referrer
 * (recordInstallReferrerOnce). */
export function trailEntry(path: string): { text: string; isError: boolean } {
  if (path.startsWith("/get-app")) return { text: getAppLabel(path), isError: false };
  if (path.startsWith("/app-install")) return { text: appInstallLabel(path), isError: false };
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
          ? `Boost recovery shown${trigger ? ` (${trigger === "idle" ? "60s idle" : trigger === "skip" ? "tapped Skip" : "tapped Post ad"})` : ""}`
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

const GET_APP_PLACEMENTS: Record<string, string> = {
  strip: "bottom bar",
  post_success: "ad-posted screen",
  my_listings: "My listings",
  footer: "footer",
  header: "header",
  header_mobile: "phone header icon",
  contact: "message thread",
  saved_search: "saved search",
};

function getAppLabel(path: string): string {
  try {
    const params = new URL(path, "https://x.invalid").searchParams;
    const placementKey = params.get("placement") ?? "";
    const placement = GET_APP_PLACEMENTS[placementKey] ?? (placementKey || "unknown");
    const to = params.get("to");
    if (params.get("event") === "dismiss") return `Get app — dismissed (${placement})`;
    // Only an Open-app tap carries an in-app destination; a plain Play Store link has none.
    if (!to) return `Get app — tapped Google Play (${placement})`;
    return `Get app — tapped Open app (${placement})${to ? ` → ${to}` : ""}`;
  } catch {
    return path;
  }
}

const INSTALL_MEDIUMS: Record<string, string> = {
  qr: "QR code",
  open_in_app_strip: "website bottom bar",
  get_app_card: "website app card",
  footer_link: "website footer link",
  play_badge: "website Google Play badge",
  play_icon: "website Google Play icon",
  header_link: "website header link",
};

function appInstallLabel(path: string): string {
  try {
    const params = new URL(path, "https://x.invalid").searchParams;
    const source = params.get("source");
    const medium = params.get("medium") ?? "";
    const campaign = params.get("campaign");
    if (source === "bhavano_web") {
      return `App installed — from ${INSTALL_MEDIUMS[medium] ?? medium}${campaign ? ` (${campaign})` : ""}`;
    }
    if (source === "google-play" && medium === "organic") return "App installed — Play Store search/browse";
    if (source) return `App installed — ${[source, medium, campaign].filter(Boolean).join(" / ")}`;
    return "App installed — source unknown";
  } catch {
    return path;
  }
}

const SITE_URL = "https://www.bhavano.com";

const EVENT_MARKER_PREFIXES = ["/login-nudge", "/post/boost-recovery", "/post/error", "/get-app", "/app-install"];

/** The real page to open for a trail entry, or null for an event marker (see trailEntry above) —
 * those aren't pages anyone can visit, just an event encoded as a path, so there's nothing to
 * link to. */
export function trailEntryHref(path: string): string | null {
  if (EVENT_MARKER_PREFIXES.some((prefix) => path.startsWith(prefix))) return null;
  return `${SITE_URL}${path}`;
}
