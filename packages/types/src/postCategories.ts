import type { ListingCategory } from "./index";

export interface PostCategoryOption {
  value: ListingCategory;
  label: string;
  icon: string;
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
export const POST_CATEGORY_GROUPS: PostCategoryGroup[] = [
  {
    title: "Property",
    options: [
      { value: "house", label: "House", icon: "🏡" },
      { value: "apartment", label: "Apartment", icon: "🏢" },
      { value: "villa", label: "Villa", icon: "🏘️" },
      { value: "plot", label: "Plot", icon: "🗺️" },
      // Land, whichever way it is eventually used. Someone with a plot to sell thinks of it as
      // property long before they think of it as commercial.
      { value: "pg", label: "PG / Hostel", icon: "🛏️" },
    ],
  },
  {
    title: "Commercial & workspace",
    options: [
      { value: "commercial", label: "Commercial space", icon: "🏬" },
      { value: "coworking", label: "Coworking", icon: "💼" },
      { value: "storage", label: "Storage space", icon: "📦" },
    ],
  },
  {
    title: "Home & furniture",
    options: [
      { value: "furniture", label: "Furniture", icon: "🛋️" },
      { value: "interiors", label: "Interiors", icon: "🎨" },
    ],
  },
];

/** Flat list, for anywhere that needs to look a category up rather than offer a choice. */
export const POST_CATEGORIES: PostCategoryOption[] = POST_CATEGORY_GROUPS.flatMap((g) => g.options);
