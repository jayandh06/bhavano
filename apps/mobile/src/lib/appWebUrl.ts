const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL ?? "https://bhavano.com";

/**
 * Builds a bhavano.com URL for opening in the system browser (WebBrowser.openBrowserAsync /
 * Linking.openURL) — tagged with `app=1` so the web app's middleware can record that visit as
 * coming from the app's own browser rather than a person's regular mobile browser (see
 * apps/web/src/middleware.ts and the Page visits admin screen's device-type column). `path` may
 * already carry its own query string (e.g. "/my-listings?openBoost=123").
 */
export function appWebUrl(path: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${SITE_URL}${path}${separator}app=1`;
}

/**
 * A plain bhavano.com URL with no `app=1` tag — for a link handed to someone else entirely
 * (native Share sheet, WhatsApp, copy-link), not opened in this app's own in-app browser. That
 * tag means "this visit came from our own in-app browser" to the web app's middleware; tagging a
 * link a recipient opens in their own regular browser would misattribute their visit as ours.
 */
export function publicWebUrl(path: string): string {
  return `${SITE_URL}${path}`;
}
