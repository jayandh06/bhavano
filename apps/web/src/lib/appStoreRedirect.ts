import { NextRequest, NextResponse } from "next/server";
import { appStoreUrl, isIosBrowser, isSafeReferrerPart, playInstallUrl } from "./appLinks";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://local.bhavano.com";
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.finfolia.bhavano";

/**
 * Where an SMS "get the app" link lands. A short, fixed URL on our own domain rather than the raw
 * Play listing: the SMS template (DLT-registered) can never change, while the destination can —
 * when the iOS app ships, only `app()` below needs an App Store branch, not a new template.
 *
 * `request.nextUrl.origin` is deliberately not used: behind Caddy it carries the internal origin
 * the container was reached on (see middleware.ts's isOwnHost), so the fallback is built from the
 * public site URL instead.
 *
 * 302, not 301: the destination is expected to change (iOS), and a cached permanent redirect
 * would keep sending people to the old one. Not indexable on purpose — `X-Robots-Tag` here and
 * absent from sitemap.ts, so this never competes with the homepage.
 */
function redirect(location: string): NextResponse {
  const response = NextResponse.redirect(location, 302);
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

function playStoreUrl(campaign: string): string {
  const referrer = encodeURIComponent(`utm_source=sms&utm_medium=outreach&utm_campaign=${campaign}`);
  return `${PLAY_STORE_URL}&referrer=${referrer}`;
}

/** `/app` — Android goes to the Play listing, iPhone/iPad to the App Store; desktop and anything else to
 * the homepage, which is where sign-in lives. */
export function appRedirect(request: NextRequest): NextResponse {
  const userAgent = request.headers.get("user-agent") ?? "";
  if (/android/i.test(userAgent)) return redirect(playStoreUrl("broker-invite"));
  if (isIosBrowser(userAgent)) return redirect(appStoreUrl("sms", "broker-invite"));
  return redirect(SITE_URL);
}

/** `/ios` — always the App Store listing, whatever the device. With `?m=<medium>&c=<campaign>` (the site's own
 * buttons, see iosInstallHref) the campaign token carries the placement. */
export function iosRedirect(request?: NextRequest): NextResponse {
  const medium = request?.nextUrl.searchParams.get("m") ?? null;
  const campaign = request?.nextUrl.searchParams.get("c") ?? null;
  if (isSafeReferrerPart(medium) && isSafeReferrerPart(campaign)) return redirect(appStoreUrl(medium, campaign));
  return redirect(appStoreUrl("sms", "ios-link"));
}

/** `/android` — always the Play listing, whatever the device.
 *
 * With `?m=<medium>&c=<campaign>` (the site's own "Get the app" buttons, see androidInstallHref) the install
 * referrer is the site's usual one plus `ws=<this visitor's session>` read from the httpOnly `bhavano_sid`
 * cookie, so the app can link the person's web visits to the account they log in with. Without those params
 * (the SMS link) nothing changes. A missing cookie (crawlers, cookies off) just leaves `ws` out. */
export function androidRedirect(request?: NextRequest): NextResponse {
  const medium = request?.nextUrl.searchParams.get("m") ?? null;
  const campaign = request?.nextUrl.searchParams.get("c") ?? null;
  if (request && isSafeReferrerPart(medium) && isSafeReferrerPart(campaign)) {
    return redirect(playInstallUrl(medium, campaign, request.cookies.get("bhavano_sid")?.value));
  }
  return redirect(playStoreUrl("android-link"));
}
