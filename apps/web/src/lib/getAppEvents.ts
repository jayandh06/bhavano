import { pushDataLayerEvent } from "./gtm";

export type GetAppPlacement = "strip" | "post_success" | "my_listings" | "footer" | "contact" | "saved_search";

/** One tap on (or dismissal of) a get-the-app control, reported twice: to GTM/GA4 as
 * `open_in_app_click` / `open_in_app_dismiss`, and to the admin Page visits trail as a synthetic
 * `/get-app?event=…&placement=…&to=…` page view (decoded by the admin app's trailEntry()) — the
 * trail only reads PageView rows, so a dataLayer event alone never shows there.
 *
 * `keepalive` matters: the Open-app tap navigates to an intent:// URL straight after this. */
export function reportGetAppEvent(event: "click" | "dismiss", placement: GetAppPlacement, appPath?: string): void {
  pushDataLayerEvent(event === "click" ? "open_in_app_click" : "open_in_app_dismiss", {
    placement,
    ...(appPath !== undefined && { app_path: appPath || "/" }),
  });
  const params = new URLSearchParams({ event, placement });
  if (appPath !== undefined) params.set("to", appPath || "/");
  void fetch("/api/analytics/pageview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: `/get-app?${params.toString()}` }),
    keepalive: true,
  }).catch(() => {
    // Best-effort, same as ListingLoginNudge's reportLoginNudgeEvent.
  });
}
