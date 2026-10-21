import { extractListingId, parseSegments } from "./seoRoute";

/** Links from the website into the Android app — see docs/plans/drive-users-to-android-app.md.
 * Used from both server (Footer) and client components: no server-only imports, and no React
 * hooks (those live in useAppLinkEnv.ts). */

export const ANDROID_PACKAGE = "com.finfolia.bhavano";

/** Play Store listing tagged with a Play install referrer, so Play Console's acquisition report
 * splits installs by where on the site they came from. The QR images in public/app-qr/ encode
 * this URL for their placement — regenerate them if this format changes:
 *   pnpm dlx qrcode -t svg -o apps/web/public/app-qr/<campaign>.svg "<playStoreUrl('qr', '<campaign>')>" */
export function playStoreUrl(medium: string, campaign: string): string {
  const referrer = `utm_source=bhavano_web&utm_medium=${medium}&utm_campaign=${campaign}`;
  return `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}&referrer=${encodeURIComponent(referrer)}`;
}

/** The website's "Get the app" buttons point here instead of straight at Play: the `/android` route reads this
 * visitor's (httpOnly) session cookie on the server and adds it to the Play install referrer as `ws`, so the app
 * can later tie the person's anonymous web visits to the account they log in with. Static QR codes cannot carry a
 * per-visitor value, so they keep using playStoreUrl(). */
export function androidInstallHref(medium: string, campaign: string): string {
  return `/android?m=${encodeURIComponent(medium)}&c=${encodeURIComponent(campaign)}`;
}

/** `medium`/`campaign` arrive in a URL on our own domain, so only plain identifiers are accepted. */
export function isSafeReferrerPart(value: string | null): value is string {
  return !!value && /^[a-z0-9_-]{1,40}$/i.test(value);
}

const WEB_SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Play listing with the install referrer for a button on the site, plus this visitor's website session (`ws`)
 * when there is one. The session id is an opaque random UUID; it only ever lets the BFF fill the owner of that
 * one anonymous Visit row after the person logs in on the app. */
export function playInstallUrl(medium: string, campaign: string, webSessionId?: string | null): string {
  const base = playStoreUrl(medium, campaign);
  if (!webSessionId || !WEB_SESSION_ID.test(webSessionId)) return base;
  const referrer = `utm_source=bhavano_web&utm_medium=${medium}&utm_campaign=${campaign}&ws=${webSessionId}`;
  return `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}&referrer=${encodeURIComponent(referrer)}`;
}

/** Web routes whose app route has the same path (expo-router strips the `(tabs)` group). */
const SAME_PATH_ROUTES = new Set([
  "post",
  "referrals",
  "purchases",
  "help",
  "about",
  "contact",
  "privacy",
  "terms",
]);

/** The app route for a website path, or "" (the app's home) when the app has no equivalent.
 * Never guesses: an unmatched bhavano:// path would land on the app's not-found screen. */
export function appPathForWebPath(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return "";
  const [first, ...rest] = segments;

  if (SAME_PATH_ROUTES.has(first)) return rest.length === 0 ? first : "";
  if (first === "favourites") return "saved";
  if (first === "requirements") return "requirements";
  if (first === "my-requirements") return "my-requirements";
  if (first === "listings") return rest.length === 1 ? `listing/${rest[0]}` : "";
  if (first === "my-listings") {
    return rest.length === 2 && rest[1] === "edit" ? `my-listings/${rest[0]}/edit` : "my-listings";
  }
  if (first === "messages") {
    // /messages, /messages/<id> and /messages/new/<listingId> all exist in the app.
    return rest.length <= 2 ? segments.join("/") : "messages";
  }

  // Anything else is the /{city}/... browse grammar: only a listing has an app screen.
  const parsed = parseSegments(rest);
  return parsed?.listingSlugId ? `listing/${extractListingId(parsed.listingSlugId)}` : "";
}

/** Chrome-on-Android intent link: opens `bhavano://<appPath>` when the app is installed, and the
 * Play Store page otherwise. A plain bhavano:// href would do nothing at all without the app. */
export function androidIntentUrl(appPath: string, medium: string, campaign: string): string {
  const fallback = encodeURIComponent(playStoreUrl(medium, campaign));
  return `intent://${appPath}#Intent;scheme=bhavano;package=${ANDROID_PACKAGE};S.browser_fallback_url=${fallback};end`;
}

/** Android Chrome / Samsung Internet etc. — excludes in-app WebViews (Facebook, Instagram and
 * other `; wv)` user agents), where intent:// links are unreliable. */
export function isAndroidBrowser(userAgent: string): boolean {
  return /Android/i.test(userAgent) && !/; wv\)/.test(userAgent);
}

const AD_VISIT_KEY = "bhavano_ad_visit_at";
/** Google Ads' default click-through conversion window. */
const AD_VISIT_MS = 30 * 24 * 60 * 60 * 1000;

function isAdClick(search: string): boolean {
  const params = new URLSearchParams(search);
  return params.has("gclid") || params.has("gbraid") || params.has("wbraid") || params.get("utm_medium") === "cpc";
}

/** Remembers an ad click on its landing page, for `cameFromAdRecently` on later pages. */
export function recordAdVisit(search: string): void {
  if (!isAdClick(search)) return;
  try {
    localStorage.setItem(AD_VISIT_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

/** True for a visitor who arrived from a paid ad in the last 30 days. Ad conversions ("Post ad
 * success") are only tracked on the website, so moving these visitors into the app would hide
 * their conversions from Smart Bidding. */
export function cameFromAdRecently(search: string): boolean {
  if (isAdClick(search)) return true;
  try {
    const at = Number(localStorage.getItem(AD_VISIT_KEY));
    return Number.isFinite(at) && at > 0 && Date.now() - at < AD_VISIT_MS;
  } catch {
    return false;
  }
}
