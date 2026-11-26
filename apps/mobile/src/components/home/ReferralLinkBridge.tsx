import { useEffect } from "react";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { listingIdFromPath, storeReferralCode } from "../../lib/referralLink";
import { recordReferralClick } from "../../lib/bffClient";
import { useMarket } from "../../lib/market";
import { appRouteFor, parseMarketLink, takePendingLink } from "../../lib/marketLinks";
import { getAnalyticsSessionId } from "../../lib/analyticsSession";

/** The last link acted on. Remounting (a market switch) reports the launch link again; it must not reopen in the other market. */
let handledUrl: string | null = null;

/** Handles an incoming deep link (a tapped universal link, or a cold launch into one) carrying a
 * shared listing/referral link's `?ref=<userId>` — persists the code for signup attribution (see
 * referralLink.ts) and navigates to the shared listing. A link with no `ref` param just falls
 * through with no navigation; this never fights expo-router's own handling of the app's own
 * `bhavano://` scheme links.
 *
 * `associatedDomains`/`intentFilters` (app.config.js) are what let iOS/Android hand a tapped
 * https://www.bhavano.com/... link to this app at all, ahead of the system browser — see that
 * file's own comments for the platform-console setup (Apple Team ID, Android signing-cert
 * fingerprint) still needed before this actually fires on a real device, and
 * docs/plans/bhavano-referral-program-implementation.md's Phase 1 for the full picture. */
export function ReferralLinkBridge(): null {
  const url = Linking.useURL();
  const router = useRouter();
  const market = useMarket();

  useEffect(() => {
    // A link the person chose to follow into this market, kept across the switch. Nothing else has routed it.
    const followed = takePendingLink();
    const next = followed ?? (url && url !== handledUrl ? url : null);
    if (!next) return;
    const link = parseMarketLink(next);
    // The other market's link: +native-intent shows the switch screen. Left unhandled, and nothing is recorded on this market's server.
    if (link && link.market !== market.id) return;
    handledUrl = next;

    const { path, queryParams } = Linking.parse(next);
    const refParam = queryParams?.ref;
    const referralCode = Array.isArray(refParam) ? refParam[0] : refParam;
    // The router opens "/listing/{id}" and "/listings/{id}" links itself (+native-intent); a website listing address is opened here.
    const direct = !!link && /^\/listings?\//.test(link.path);
    const listingId = direct ? link.path.split("/")[2] : path ? listingIdFromPath(path) : undefined;
    if (referralCode) {
      void storeReferralCode(referralCode);
      // Best-effort, not awaited — same stance as web's middleware.ts click log: a dropped call
      // never delays opening the shared listing.
      recordReferralClick(referralCode, getAnalyticsSessionId(), listingId).catch(() => undefined);
    }

    if (followed) {
      const route = link ? appRouteFor(link.path) : "/";
      // After the navigator below this component has mounted again.
      if (route !== "/") setTimeout(() => router.push(route as never), 0);
      return;
    }
    if (listingId && !direct) router.push(`/listing/${listingId}` as never);
  }, [url, router, market.id]);

  return null;
}
