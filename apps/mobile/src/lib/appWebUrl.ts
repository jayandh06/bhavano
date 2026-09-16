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
