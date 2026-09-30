/**
 * When the dismissible login ask on listing detail may appear — shared by web and app so both
 * read the admin settings the same way. The listing itself is never gated; see
 * docs/plans/listing-detail-login-nudge.md for why each web rule exists (search rankings and
 * Google Ads landing-page experience).
 */
/** How a browser visit began: a paid ad click, an organic search result, or anything else. */
export type VisitEntry = "ad" | "search" | "other";
/** Classifies the first page of a visit from its query string and `document.referrer`. */
export declare function classifyVisitEntry(search: string, referrer: string): VisitEntry;
/** Stable 0–99 bucket for a viewer key, so the same visitor stays in or out of a rollout. */
export declare function rolloutBucket(viewerKey: string): number;
export declare function inDismissCooldown(dismissedAtMs: number | null, cooldownDays: number, nowMs: number): boolean;
/** Hard floor on the web: the card never shows on the first listing of a visit, whatever the
 * setting says, so a visitor arriving from search or an ad never gets it on their landing page. */
export declare const WEB_PROMPT_MIN_DETAIL_VIEWS = 2;
export declare function shouldShowWebLoginPrompt(input: {
    enabled: boolean;
    afterDetailViews: number;
    rolloutPercent: number;
    excludeAdAndSearchLanding: boolean;
    cooldownDays: number;
    /** Listing detail pages opened in this browser session, including the current one. */
    detailViewsThisSession: number;
    visitEntry: VisitEntry;
    viewerKey: string;
    dismissedAtMs: number | null;
    shownThisSession: boolean;
    nowMs: number;
}): boolean;
export declare function shouldShowAppLoginPrompt(input: {
    enabled: boolean;
    afterDetailViews: number;
    cooldownDays: number;
    /** Listing detail screens opened since the last skip (or ever, before the first one). */
    detailViews: number;
    dismissedAtMs: number | null;
    nowMs: number;
}): boolean;
