/** Which on-site link/button sent a visitor to `/post` (its own `?from=` query param) — see
 * docs/plans/post-ad-funnel-step-tracking-and-entry-attribution.md. A fixed, shared list (not a
 * bare string) so web and mobile use the same vocabulary and a typo'd/forged query value can't
 * pollute the admin funnel view with a never-seen-again slug. */
export declare const POST_ENTRY_SOURCES: readonly ["header_desktop", "header_mobile", "utility_bar", "drawer", "footer", "my_listings_empty", "plans_table", "plans_page", "requirements_feed", "ad_landing_card", "post_another_ad", "bottom_tab"];
export type PostEntrySource = (typeof POST_ENTRY_SOURCES)[number];
/** Default for a typed URL, a bookmark, browser back/forward, or any `?from=` value not in the
 * list above (including none at all). */
export declare const DEFAULT_POST_ENTRY = "direct";
export declare function resolvePostEntry(value: unknown): PostEntrySource | typeof DEFAULT_POST_ENTRY;
