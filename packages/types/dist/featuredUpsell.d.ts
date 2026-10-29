/** The "make your ad Featured" ask shown to an owner who has a live ad that is not Featured: a dialog when they open My listings and a slim card on their own listing page.
 * Admin-controlled (Admin -> Settings -> Featured prompt), off by default. See docs/plans/featured-upsell-prompt.md. */
export interface FeaturedUpsellSettingsDto {
    /** The dialog on My listings. */
    enabled: boolean;
    /** The slim card at the top of the owner's own listing page. */
    listingCardEnabled: boolean;
    /** An ad this young is left alone: the owner has just been offered Featured while posting. */
    minAgeHours: number;
    /** After "Not now", stay quiet for this many days (per ad). */
    quietDays: number;
    /** Most times one ad is ever offered, so a firm "no" is respected. */
    maxShowsPerAd: number;
}
export declare const DEFAULT_FEATURED_UPSELL_SETTINGS: FeaturedUpsellSettingsDto;
/** What the browser remembers about one ad: how often it was offered and when the owner last said "Not now". */
export interface FeaturedUpsellMemory {
    shows: number;
    dismissedAtMs: number | null;
}
export interface UpsellCandidate {
    id: string;
    status: string;
    publishState?: string | null;
    isBoosted: boolean;
    createdAt: string;
}
export declare function isUpsellEligibleListing(l: UpsellCandidate, minAgeHours: number, nowMs: number): boolean;
/** Decides whether to offer Featured on this visit, and for which ad. Once per browser session (`shownThisSession`), never for an ad offered `maxShowsPerAd` times or dismissed
 * within `quietDays`; the newest eligible ad is the one offered. Returns null when nothing should show. */
export declare function pickFeaturedUpsell<T extends UpsellCandidate>(input: {
    settings: Pick<FeaturedUpsellSettingsDto, "minAgeHours" | "quietDays" | "maxShowsPerAd">;
    listings: readonly T[];
    memory: (listingId: string) => FeaturedUpsellMemory;
    shownThisSession: boolean;
    nowMs: number;
}): T | null;
