"use client";

import { buildListingPath } from "@/lib/listingPath";
import { taggedShareUrl, facebookShareHref } from "@/lib/shareLinks";
import { pushDataLayerEvent } from "@/lib/gtm";
import { recordShareTapAction } from "@/app/actions/referrals";
import { FacebookIcon } from "./FacebookIcon";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bhavano.com";

type ShareableListing = Parameters<typeof buildListingPath>[0] & {
  id: string;
  viewerReferralCode?: string;
};

/**
 * The owner sharing their own ad to their own Facebook feed — a different audience from the
 * Bhavano Page's own auto-post (docs/plans/facebook-page-publishing.md), which only reaches the
 * Page's followers, not the owner's friends/family/local groups. Same `owner_share` pattern as
 * OwnerWhatsAppShare (tagged link, referral credit, tap logging), just pointed at Facebook's
 * share dialog instead of wa.me — compact-only, since it always sits beside an existing WhatsApp
 * share action rather than needing its own full card.
 *
 * Facebook's share dialog takes no pre-filled text (see facebookShareHref), so there's no message
 * to compose here the way OwnerWhatsAppShare has one.
 */
export function OwnerFacebookShare({
  listing,
  placement,
  referralCode,
}: {
  listing: ShareableListing;
  /** Which screen it was tapped on, for the `owner_share_facebook` event. */
  placement: "post_success" | "my_listings";
  referralCode?: string;
}) {
  const code = referralCode ?? listing.viewerReferralCode;
  const url = taggedShareUrl(`${SITE_URL}${buildListingPath(listing)}`, "facebook", "owner_share", code);
  const href = facebookShareHref(url);
  const onClick = () => {
    pushDataLayerEvent("owner_share_facebook", { listingId: listing.id, placement });
    void recordShareTapAction(listing.id, "facebook");
  };

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      aria-label="Share on Facebook"
      title="Share on Facebook"
      className="text-[15px] font-bold text-green border-[1.5px] border-green rounded-lg px-2.5 py-2 inline-flex items-center"
    >
      <FacebookIcon />
    </a>
  );
}
