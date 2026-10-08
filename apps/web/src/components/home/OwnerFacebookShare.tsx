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
 * share dialog instead of wa.me.
 *
 * Facebook's share dialog takes no pre-filled text (see facebookShareHref), so there's no message
 * to compose here the way OwnerWhatsAppShare has one.
 */
export function OwnerFacebookShare({
  listing,
  placement,
  referralCode,
  variant = "compact",
}: {
  listing: ShareableListing;
  /** Which screen it was tapped on, for the `owner_share_facebook` event. */
  placement: "post_success" | "my_listings";
  referralCode?: string;
  /** "prominent": its own full-width button, same treatment as OwnerWhatsAppShare's own
   * prominent variant — used on the post-success share card, on its own line below WhatsApp's
   * button rather than squeezed beside it as a small icon. "compact" (default): the small
   * icon-only button used inline (e.g. the My Listings row). */
  variant?: "prominent" | "compact";
}) {
  const code = referralCode ?? listing.viewerReferralCode;
  const url = taggedShareUrl(`${SITE_URL}${buildListingPath(listing)}`, "facebook", "owner_share", code);
  const href = facebookShareHref(url);
  const onClick = () => {
    pushDataLayerEvent("owner_share_facebook", { listingId: listing.id, placement });
    void recordShareTapAction(listing.id, "facebook");
  };

  if (variant === "prominent") {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
        className="w-full bg-green text-on-green rounded-lg px-5 py-3 text-[15px] font-bold text-center inline-flex items-center justify-center gap-2"
      >
        <FacebookIcon size={22} /> Share on Facebook
      </a>
    );
  }

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
      <FacebookIcon size={20} />
    </a>
  );
}
