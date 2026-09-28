import type { BoostOfferMessageCardDto, ListingCategory } from '@bhavano/types';
import { PURCHASE_SOURCE_PARAM, type PurchaseSource } from '@bhavano/types/purchaseSource';

const ADMIN_BOOST_MESSAGE_SOURCE: PurchaseSource = 'admin_boost_message';

/** The in-app "Bhavano Admin" Boost message — see docs/plans/admin-in-app-boost-message.md.
 *
 * Pure functions so the wording, and above all the figures in it, can be pinned by a test. The
 * prices passed in are what the seller will actually be charged (discount included), the same
 * figures the email quotes, so the message and the checkout screen it links to agree.
 *
 * The message goes out twice over in one row: a card (`buildBoostMessageCard`) that current web
 * and app versions draw with the cover photo, title and a Boost button, and the plain-text `body`
 * (`buildBoostMessageBody`) that older app versions, the push preview and the admin views show.
 * Both are built from the same sentences below so they can't drift apart.
 *
 * The first sentence of the body is the whole pitch on purpose: the same text is the push
 * notification's preview, which shows only its opening, and an opening of "Hi Ravi, your ad is
 * live…" would be cut off before it said anything worth acting on.
 *
 * Nothing here promises a placement the product does not guarantee: the featured tier is capped
 * (BOOST_FEATURED_CAP), so the copy says "above unboosted listings, with a Featured label", the
 * same wording the email uses, not "top of results". Instant Alerts is part of every boost, so it
 * is described as included, never as an extra. */
export interface BoostMessageInput {
  /** The ad's title, quoted so the seller knows which ad it is about. */
  title: string;
  /** "Area, City". */
  location: string;
  boostPrice: number;
  boostDays: number;
  /** The 30-day option, quoted as the better value per day. Omitted when there is none to quote. */
  longer?: { days: number; price: number };
  /** Present only while a promo is live — switches the message to the offer wording. */
  offer?: { discountPercent: number; boostBasePrice: number; endsOn: string };
  /** `${site}${boostMessagePath(listingId)}` — opens the boost dialog for this ad. */
  boostLink: string;
}

function bodyParagraphs({ location, longer }: BoostMessageInput): string[] {
  return [
    `Ads without a boost get very few views in their first week. A boosted ad is shown above ` +
      `unboosted listings in ${location}, with a Featured label, and Instant Alerts is included, so you ` +
      `hear the moment someone messages you about it.`,
    ...(longer ? [`Want it to run longer? ${longer.days} days is ₹${longer.price}, a lower price per day.`] : []),
    `One-time payment, no subscription. Your ad stays live and free either way.`,
  ];
}

export function buildBoostMessageBody(input: BoostMessageInput): string {
  const { title, boostPrice, boostDays, offer, boostLink } = input;

  const opening = offer
    ? `Get more views on "${title}": boost it for ${boostDays} days at ₹${boostPrice} (was ₹${offer.boostBasePrice}). ` +
      `${offer.discountPercent}% off until ${offer.endsOn}, applied for you, no code needed.`
    : `Get more views on "${title}": boost it for ${boostDays} days for ₹${boostPrice}.`;

  return [opening, ...bodyParagraphs(input), `Boost my ad: ${boostLink}`].join('\n\n');
}

export function buildBoostMessageCard(
  input: BoostMessageInput,
  listing: { id: string; category: ListingCategory; imageUrl: string | null },
): BoostOfferMessageCardDto {
  const { title, location, boostPrice, boostDays, offer } = input;
  return {
    kind: 'boost_offer',
    listingId: listing.id,
    category: listing.category,
    title,
    location,
    imageUrl: listing.imageUrl,
    headline: `Boost it for ${boostDays} days ${offer ? 'at' : 'for'} ₹${boostPrice}`,
    offerNote: offer
      ? `${offer.discountPercent}% off until ${offer.endsOn} · was ₹${offer.boostBasePrice} · applied for you, no code needed`
      : null,
    paragraphs: bodyParagraphs(input),
    ctaLabel: `Boost my ad · ₹${boostPrice}`,
    ctaPath: boostMessagePath(listing.id),
  };
}

/** Where the message's Boost button (and the plain-text link) goes: the boost dialog for this ad,
 * tagged so the payment is recorded as coming from this message. */
export function boostMessagePath(listingId: string): string {
  return `/my-listings?openBoost=${listingId}&${PURCHASE_SOURCE_PARAM}=${ADMIN_BOOST_MESSAGE_SOURCE}`;
}
