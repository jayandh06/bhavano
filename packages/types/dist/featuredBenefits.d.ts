/** What a Featured ad actually gets, in the words shown on the post-ad offer screen (web and mobile
 * share this list so they can never disagree). Every line is true today: the card styling and photo
 * cycling are driven by `isBoosted`, ordering by `boostRank`, the home rail by the Featured rail, Instant
 * Alerts are included in every boost, and the media limits come from the same constants the BFF enforces.
 * Never promise a fixed position: only 8 guaranteed slots exist across the first two pages. See
 * docs/plans/featured-ad-benefits-and-media-limits.md. */
/** True only while an admin has Admin -> Settings -> Seeker contact switched on, so the list never promises a number nobody can see. */
export declare const FEATURED_LEAD_CONTACT_BENEFIT = "See the phone number of people interested in your ad and call them directly";
/** The benefits to show right now: with seeker contact on, the number benefit leads the list. */
export declare function featuredBenefits(leadContactOn: boolean): readonly string[];
export declare const FEATURED_BENEFITS: readonly string[];
