/** Field-level events on the posting wizard's Details step, recorded as synthetic page visits so they show up
 * in admin's Page visits trail and feed the post-funnel "blocked at Preview" table (Phase 0 of
 * docs/plans/post-details-step-experience.md). Same trick as `/post/action` and `/post/error`.
 *
 * Path: `/post/field?event=<name>&field=<target>&category=<category>[&ms=<n>][&left=<n>]`. Deliberately not under
 * `/post/details` or `/post/category`: the funnel counts sessions by path prefix, and an event must not read as
 * another arrival at a step. Only a target name and a category travel, never what the seller typed. */
export declare const POST_FIELD_EVENTS: readonly ["first_touch", "preview_blocked", "chip_tapped", "details_exit"];
export type PostFieldEvent = (typeof POST_FIELD_EVENTS)[number];
export declare const POST_FIELD_PATH_PREFIX = "/post/field";
export declare function postFieldEventPath(event: PostFieldEvent, detail?: {
    field?: string | null;
    category?: string | null;
    ms?: number;
    left?: number;
}): string;
export interface ParsedPostFieldEvent {
    event: PostFieldEvent;
    field: string | null;
    category: string | null;
    ms: number | null;
    left: number | null;
}
/** Reads a `/post/field` path back, or null when it is not a well-formed one. */
export declare function parsePostFieldEventPath(path: string): ParsedPostFieldEvent | null;
/** A target as a readable label for admin: "attr:carpetAreaSqft" becomes "carpetAreaSqft", "photos" stays. */
export declare function postFieldTargetLabel(target: string | null): string;
