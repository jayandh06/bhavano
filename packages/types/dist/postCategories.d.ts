import type { ListingCategory } from "./index";
export interface PostCategoryOption {
    value: ListingCategory;
    label: string;
    /** Emoji. Still here because the app renders this field as text and has no SVG support —
     * see `iconName`, which the web app uses instead. */
    icon: string;
    /** A key into the web app's outlined icon set (apps/web/src/components/home/Icon.tsx).
     * Typed as a string here because the icon set is a web concern and this package must not
     * depend on it; the web side narrows it with `isIconName` before rendering. */
    iconName: string;
}
export interface PostCategoryGroup {
    /** Section heading above the group. */
    title: string;
    options: PostCategoryOption[];
}
/**
 * The posting wizard's first step, grouped.
 *
 * Ten categories in one undifferentiated grid made the poster read every tile to find theirs, and
 * put Interiors next to Villa for no reason a person could infer. Grouping turns it into "which
 * of these three am I?" followed by a short list — someone selling a flat never has to consider
 * furniture at all.
 *
 * Order is by expected volume, not alphabet: residential property is the overwhelming majority of
 * what gets posted, so it comes first and needs no scrolling on a phone.
 *
 * Shared by apps/web and apps/mobile, which each had their own copy of this list. Two copies of
 * the same vocabulary drift, and a category added to one but not the other is invisible until a
 * user cannot find it.
 */
export declare const POST_CATEGORY_GROUPS: PostCategoryGroup[];
/** Flat list, for anywhere that needs to look a category up rather than offer a choice. */
export declare const POST_CATEGORIES: PostCategoryOption[];
