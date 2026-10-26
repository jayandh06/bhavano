import type { BoostOfferMessageCardDto, ListingCategory } from '@bhavano/types';
import { PURCHASE_SOURCE_PARAM, type PurchaseSource } from '@bhavano/types/purchaseSource';

const ADMIN_BOOST_MESSAGE_SOURCE: PurchaseSource = 'admin_boost_message';
const FEATURED_EXPIRY_SOURCE: PurchaseSource = 'featured_expiry_message';

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
 * (BOOST_FEATURED_CAP), so the copy says "above other listings, with a Featured badge", the
 * same wording the email uses, not "top of results". Instant Alerts is part of every Feature, so
 * it is described as included, never as an extra. */
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
    `Ads without Feature get very few views in their first week. A Featured ad is shown above ` +
      `other listings in ${location}, with a Featured badge, and Instant Alerts is included, so you ` +
      `hear the moment someone messages you about it.`,
    ...(longer ? [`Want it to run longer? ${longer.days} days is ₹${longer.price}, a lower price per day.`] : []),
    `One-time payment, no subscription. Your ad stays live and free either way.`,
  ];
}

export function buildBoostMessageBody(input: BoostMessageInput): string {
  const { title, boostPrice, boostDays, offer, boostLink } = input;

  const opening = offer
    ? `Get more views on "${title}": feature it for ${boostDays} days at ₹${boostPrice} (was ₹${offer.boostBasePrice}). ` +
      `${offer.discountPercent}% off until ${offer.endsOn}, applied for you, no code needed.`
    : `Get more views on "${title}": feature it for ${boostDays} days for ₹${boostPrice}.`;

  return [opening, ...bodyParagraphs(input), `Feature my ad: ${boostLink}`].join('\n\n');
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
    headline: `Feature it for ${boostDays} days ${offer ? 'at' : 'for'} ₹${boostPrice}`,
    offerNote: offer
      ? `${offer.discountPercent}% off until ${offer.endsOn} · was ₹${offer.boostBasePrice} · applied for you, no code needed`
      : null,
    paragraphs: bodyParagraphs(input),
    ctaLabel: `Feature my ad · ₹${boostPrice}`,
    ctaPath: boostMessagePath(listing.id),
  };
}

/** Where the message's Boost button (and the plain-text link) goes: the boost dialog for this ad,
 * tagged so the payment is recorded as coming from this message. */
export function boostMessagePath(listingId: string, source: PurchaseSource = ADMIN_BOOST_MESSAGE_SOURCE): string {
  return `/my-listings?openBoost=${listingId}&${PURCHASE_SOURCE_PARAM}=${source}`;
}

/** The "your Featured ad is ending" reminder, sent 3 days and 1 day before the Feature period ends — see
 * docs/plans/featured-expiry-reminder.md. Same shape as the Boost offer (a card plus a plain-text body whose first sentence is the
 * push preview), so every current web and app build draws it. */
export interface ExpiryReminderInput {
  title: string;
  /** "Area, City". */
  location: string;
  /** 3 or 1. */
  daysLeft: number;
  /** "29 October", in IST. */
  endsOn: string;
  renewDays: number;
  /** What the seller will be charged for a renewal (plain price; checkout applies any code). */
  renewPrice: number;
  renewLink: string;
}

function endsPhrase(daysLeft: number): string {
  return daysLeft <= 1 ? 'tomorrow' : `in ${daysLeft} days`;
}

function expiryParagraphs({ renewDays, renewPrice }: ExpiryReminderInput): string[] {
  return [
    `After that it goes back to the normal order and loses the Featured badge. Your ad stays live and free either way.`,
    `Renew for ${renewDays} days at ₹${renewPrice}. The days you have left are kept: the new period starts when this one ends.`,
    `One-time payment, no subscription.`,
  ];
}

export function buildExpiryReminderBody(input: ExpiryReminderInput): string {
  const opening = `Your Featured ad "${input.title}" ends ${endsPhrase(input.daysLeft)} (${input.endsOn}). Renew to keep it above other listings.`;
  return [opening, ...expiryParagraphs(input), `Renew Feature: ${input.renewLink}`].join('\n\n');
}

export function buildExpiryReminderCard(
  input: ExpiryReminderInput,
  listing: { id: string; category: ListingCategory; imageUrl: string | null },
): BoostOfferMessageCardDto {
  return {
    kind: 'boost_offer',
    listingId: listing.id,
    category: listing.category,
    title: input.title,
    location: input.location,
    imageUrl: listing.imageUrl,
    headline: `Your Featured ad ends ${endsPhrase(input.daysLeft)}`,
    offerNote: `Ends ${input.endsOn} · renewing adds to the days you have left`,
    paragraphs: expiryParagraphs(input),
    ctaLabel: `Renew Feature · ₹${input.renewPrice}`,
    ctaPath: boostMessagePath(listing.id, FEATURED_EXPIRY_SOURCE),
  };
}

/** Where the reminder's Renew link goes: the Feature dialog for this ad, counted as coming from the reminder. */
export function expiryReminderPath(listingId: string): string {
  return boostMessagePath(listingId, FEATURED_EXPIRY_SOURCE);
}
