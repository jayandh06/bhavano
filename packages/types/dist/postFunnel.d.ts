/** One step of the `/post` posting-wizard funnel — see AdminService.getPostFunnel and
 * docs/plans/post-ad-funnel-step-tracking-and-entry-attribution.md. Ordered: each step's
 * `sessions` is a subset of the previous one's (a session reaching Details necessarily reached
 * Category first), except `/post` itself, which can undercount slightly under an `entry`/
 * `loggedIn` filter — see that doc's own note on why. */
export interface PostFunnelStepDto {
    /** The real or synthetic PageView path this step counts — `/post`, `/post/category`, etc. */
    path: string;
    label: string;
    sessions: number;
    /** null for the first step, which has nothing to compare against. */
    pctOfPrevious: number | null;
}
export interface PostFunnelDto {
    steps: PostFunnelStepDto[];
}
/** One row of the "what blocks Preview" table: how often a field was the first thing in the way when a seller
 * tapped Preview with things left. */
export interface PostDetailsBlockerDto {
    /** The target name from `postDetailsIssues`: `location`, `price`, `photos`, `title`, ..., or `attr:<field key>`. */
    field: string;
    category: string | null;
    /** Distinct sessions this blocked at least once. */
    sessions: number;
    /** Total blocked Preview taps. */
    taps: number;
}
/** Where sellers stalled: the last field touched in sessions that left Details without going on to Preview. */
export interface PostDetailsExitDto {
    field: string | null;
    sessions: number;
    /** Median seconds spent on Details by those sessions. */
    medianSeconds: number | null;
}
/** Field-level view of the Details step (docs/plans/post-details-step-experience.md, Phase 0), built from the
 * `/post/field` events the wizards write. */
export interface PostDetailsBlockersDto {
    /** Sessions that opened Details / that went on to Preview, in the same window, for the conversion figure. */
    sessionsAtDetails: number;
    sessionsAtPreview: number;
    /** Sessions that touched any field on Details. */
    sessionsTouched: number;
    /** Sessions that tapped Preview while something was left. */
    sessionsBlocked: number;
    /** Median seconds from opening Details to the first field touched. */
    medianSecondsToFirstTouch: number | null;
    blockers: PostDetailsBlockerDto[];
    exits: PostDetailsExitDto[];
}
/** Turns raw `/post/field` events into the blockers and exits tables. `events` are the PageView rows (session id +
 * path); malformed paths are ignored. A session counts as having *exited* only if it sent `details_exit` and never
 * reached Preview (`previewSessionIds`). */
export declare function summarizePostFieldEvents(events: {
    sessionId: string;
    path: string;
}[], parse: (path: string) => {
    event: string;
    field: string | null;
    category: string | null;
    ms: number | null;
} | null, previewSessionIds: ReadonlySet<string>): Pick<PostDetailsBlockersDto, "sessionsTouched" | "sessionsBlocked" | "medianSecondsToFirstTouch" | "blockers" | "exits">;
