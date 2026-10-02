"use client";

import Link from "next/link";
import type { ListingTotalPriceDto } from "@bhavano/types";
import { listingPriceText } from "@bhavano/types/priceWords";
import { pushDataLayerEvent } from "@/lib/gtm";
import { buildListingPath } from "@/lib/listingPath";
import { taggedShareUrl, whatsappShareHref } from "@/lib/shareLinks";
import { Icon } from "./Icon";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bhavano.com";

type ShareableListing = Parameters<typeof buildListingPath>[0] & {
  id: string;
  title: string;
  price: string;
  priceInWords?: string | null;
  totalPrice?: ListingTotalPriceDto | null;
  area: string;
  cityName: string;
};

/**
 * The owner sending their own ad to WhatsApp with the message already written. Owners are the one
 * audience that always wants an ad seen, and every share puts it in front of people no ad reaches
 * (society groups, office groups, family). Tagged `owner_share` so those visits are counted
 * separately — see lib/shareLinks.ts and docs/plans/growth-beyond-google-ads.md.
 *
 * With `referralCode` (the owner's user id) the link also credits them under the referral
 * programme, and the prominent variant says so.
 */
export function OwnerWhatsAppShare({
  listing,
  placement,
  variant,
  referralCode,
}: {
  listing: ShareableListing;
  /** Which screen it was tapped on, for the `owner_share_whatsapp` event. */
  placement: "post_success" | "my_listings";
  variant: "prominent" | "compact";
  referralCode?: string;
}) {
  const url = taggedShareUrl(`${SITE_URL}${buildListingPath(listing)}`, "whatsapp", "owner_share", referralCode);
  const text = `${listing.title}\n${listingPriceText(listing, "compact")} · ${listing.area}, ${listing.cityName}\nPhotos and details on Bhavano — message me there:`;
  const href = whatsappShareHref(text, url);
  const onClick = () => pushDataLayerEvent("owner_share_whatsapp", { listingId: listing.id, placement });

  if (variant === "compact") {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
        aria-label="Share on WhatsApp"
        title="Share on WhatsApp"
        className="text-[15px] font-bold text-green border-[1.5px] border-green rounded-lg px-2.5 py-2 inline-flex items-center"
      >
        <Icon name="share" />
      </a>
    );
  }

  return (
    <div className="w-full rounded-2xl border border-border bg-surface-alt p-4 sm:p-5 flex flex-col gap-3">
      <div>
        <div className="text-[15px] font-bold text-text">Get enquiries sooner</div>
        <p className="text-[13px] text-text-soft m-0 mt-1">
          Send your ad to your society, office or family WhatsApp groups — people nearby often know
          someone looking.
        </p>
      </div>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
        className="bg-green text-on-green rounded-lg px-5 py-3 text-[15px] font-bold text-center inline-flex items-center justify-center gap-2"
      >
        <Icon name="message" /> Share on WhatsApp
      </a>
      {referralCode && (
        <p className="text-[12.5px] text-text-soft m-0">
          <Icon name="boost" className="text-[color:var(--gold)] mr-1 align-[-2px]" />
          Share your ad, and get a free boost when a friend joins from your link and posts their own.{" "}
          <Link href="/referrals" className="font-bold text-green">
            How it works
          </Link>
        </p>
      )}
    </div>
  );
}
