import { useEffect } from "react";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { listingIdFromPath, storeReferralCode } from "../../lib/referralLink";
import { recordReferralClick } from "../../lib/bffClient";
import { getAnalyticsSessionId } from "../../lib/analyticsSession";

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

  useEffect(() => {
    if (!url) return;
    const { path, queryParams } = Linking.parse(url);
    const refParam = queryParams?.ref;
    const referralCode = Array.isArray(refParam) ? refParam[0] : refParam;
    const listingId = path ? listingIdFromPath(path) : undefined;
    if (referralCode) {
      void storeReferralCode(referralCode);
      // Best-effort, not awaited — same stance as web's middleware.ts click log: a dropped call
      // never delays opening the shared listing.
      recordReferralClick(referralCode, getAnalyticsSessionId(), listingId).catch(() => undefined);
    }

    if (listingId) router.push(`/listing/${listingId}` as never);
  }, [url, router]);

  return null;
}
