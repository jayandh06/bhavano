import { IOS_APP_ID } from "./appLinks";

/** Meta Business Manager domain verification (business.facebook.com > Brand Safety > Domains) — a one-time
 * ownership proof for the WhatsApp/Meta integrations, read from the plain HTML of the site. */
const FACEBOOK_DOMAIN_VERIFICATION = "zcmoqn7tfxb945q9n2og13fpipopfb";

/** The `other` metadata block for a page: the site-wide tags plus Safari's Smart App Banner.
 *
 * Next replaces `other` wholesale when a page sets its own (it is not merged with the root layout's), so a page
 * that wants an `app-argument` must repeat the site-wide tags — hence one helper that both use.
 *
 * `appUrl` is the page's own canonical https URL. iOS hands it to the app when the banner's "Open" is tapped,
 * and as it is an associated domain (applinks:www.bhavano.com) the app's incoming-link handler opens that
 * listing instead of the home screen. Only pass it for a page the app can show (a listing); everywhere else
 * "Open" just launches the app. */
export function siteMetaOther(appUrl?: string): Record<string, string> {
  return {
    "facebook-domain-verification": FACEBOOK_DOMAIN_VERIFICATION,
    // Safari's native Smart App Banner on iPhone/iPad ("Open" if installed, "Get" otherwise). Server-rendered,
    // no JS, ignored by every other browser.
    "apple-itunes-app": `app-id=${IOS_APP_ID}${appUrl ? `, app-argument=${appUrl}` : ""}`,
  };
}
