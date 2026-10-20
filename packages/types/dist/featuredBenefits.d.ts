/** What a Featured ad actually gets, in the words shown on the post-ad offer screen (web and mobile
 * share this list so they can never disagree). Every line is true today: the card styling and photo
 * cycling are driven by `isBoosted`, ordering by `boostRank`, the home rail by the Featured rail, Instant
 * Alerts are included in every boost, and the media limits come from the same constants the BFF enforces.
 * Never promise a fixed position: only 8 guaranteed slots exist across the first two pages. See
 * docs/plans/featured-ad-benefits-and-media-limits.md. */
export declare const FEATURED_BENEFITS: readonly string[];
