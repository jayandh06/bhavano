/** The in-app "Bhavano" Boost message — see docs/plans/admin-in-app-boost-message.md.
 *
 * A pure function so the wording, and above all the figures in it, can be pinned by a test. The
 * prices passed in are what the seller will actually be charged (discount included), the same
 * figures the email quotes, so the message and the checkout screen it links to agree.
 *
 * The first sentence is the whole pitch on purpose: the same text is the push notification's
 * preview, which shows only its opening, and an opening of "Hi Ravi, your ad is live…" would be
 * cut off before it said anything worth acting on.
 *
 * Nothing here promises a placement the product does not guarantee: the featured tier is capped
 * (BOOST_FEATURED_CAP), so the copy says "above unboosted listings, with a Featured label", the
 * same wording the email uses, not "top of results". */
export interface BoostMessageInput {
  /** The ad's title, quoted so the seller knows which ad it is about. */
  title: string;
  /** "Area, City". */
  location: string;
  boostPrice: number;
  bundlePrice: number;
  boostDays: number;
  /** Present only while a promo is live — switches the message to the offer wording. */
  offer?: { discountPercent: number; boostBasePrice: number; bundleBasePrice: number; endsOn: string };
  /** `${site}/my-listings?openBoost=<listingId>` — opens the post-ad picker for this ad. */
  boostLink: string;
  /** Same, with Instant Alerts already ticked. */
  bundleLink: string;
}

export function buildBoostMessageBody(input: BoostMessageInput): string {
  const { title, location, boostPrice, bundlePrice, boostDays, offer, boostLink, bundleLink } = input;

  const opening = offer
    ? `Get more views on "${title}": boost it for ${boostDays} days at ₹${boostPrice} (was ₹${offer.boostBasePrice}). ` +
      `${offer.discountPercent}% off until ${offer.endsOn} — applied for you, no code needed.`
    : `Get more views on "${title}": boost it for ${boostDays} days for ₹${boostPrice}.`;

  const bundleLine = offer
    ? `Boost + Instant Alerts: ₹${bundlePrice} (was ₹${offer.bundleBasePrice})`
    : `Boost + Instant Alerts: ₹${bundlePrice}`;

  return [
    opening,
    '',
    `Ads without a boost get very few views in their first week. A boosted ad is shown above ` +
      `unboosted listings in ${location}, with a Featured label. Instant Alerts tells you the moment ` +
      `someone messages you about it.`,
    '',
    `One-time payment, no subscription. Your ad stays live and free either way.`,
    '',
    `Boost my ad: ${boostLink}`,
    `${bundleLine}: ${bundleLink}`,
  ].join('\n');
}
