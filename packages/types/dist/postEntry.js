"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_POST_ENTRY = exports.POST_ENTRY_SOURCES = void 0;
exports.resolvePostEntry = resolvePostEntry;
/** Which on-site link/button sent a visitor to `/post` (its own `?from=` query param) — see
 * docs/plans/post-ad-funnel-step-tracking-and-entry-attribution.md. A fixed, shared list (not a
 * bare string) so web and mobile use the same vocabulary and a typo'd/forged query value can't
 * pollute the admin funnel view with a never-seen-again slug. */
exports.POST_ENTRY_SOURCES = [
    "header_desktop",
    "header_mobile",
    "utility_bar",
    "drawer",
    "footer",
    "my_listings_empty",
    "plans_table",
    "plans_page",
    "requirements_feed",
    "ad_landing_card",
    "post_another_ad",
    "bottom_tab",
];
/** Default for a typed URL, a bookmark, browser back/forward, or any `?from=` value not in the
 * list above (including none at all). */
exports.DEFAULT_POST_ENTRY = "direct";
function resolvePostEntry(value) {
    return typeof value === "string" && exports.POST_ENTRY_SOURCES.includes(value)
        ? value
        : exports.DEFAULT_POST_ENTRY;
}
