import { PHOTO_LIMITS } from "./photoLimits";
import { VIDEO_LIMITS } from "./videoLimits";

/** What a Featured ad actually gets, in the words shown on the post-ad offer screen (web and mobile
 * share this list so they can never disagree). Every line is true today: the card styling and photo
 * cycling are driven by `isBoosted`, ordering by `boostRank`, the home rail by the Featured rail, Instant
 * Alerts are included in every boost, and the media limits come from the same constants the BFF enforces.
 * Never promise a fixed position: only 8 guaranteed slots exist across the first two pages. See
 * docs/plans/featured-ad-benefits-and-media-limits.md. */
/** True only while an admin has Admin -> Settings -> Seeker contact switched on, so the list never promises a number nobody can see. */
export const FEATURED_LEAD_CONTACT_BENEFIT = "See the phone number of people interested in your ad and call them directly";

/** The benefits to show right now: with seeker contact on, the number benefit leads the list. */
export function featuredBenefits(leadContactOn: boolean): readonly string[] {
  return leadContactOn ? [FEATURED_LEAD_CONTACT_BENEFIT, ...FEATURED_BENEFITS] : FEATURED_BENEFITS;
}

export const FEATURED_BENEFITS: readonly string[] = [
  "A gold Featured badge and card styling",
  "Priority placement above regular ads (the exact spot is not guaranteed)",
  "May appear in the Featured section on the home page",
  "Your card cycles through your photos as people browse",
  "Instant alerts by email and WhatsApp when someone messages you",
  `Up to ${PHOTO_LIMITS.elevated.maxPhotos} photos and ${VIDEO_LIMITS.elevated.maxVideos} videos (up to ${VIDEO_LIMITS.elevated.maxDurationSec / 60} minutes each)`,
];
