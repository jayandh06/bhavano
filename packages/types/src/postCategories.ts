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
export const POST_CATEGORY_GROUPS: PostCategoryGroup[] = [
  {
    title: "Property",
    options: [
      { value: "house", label: "House", icon: "🏡", iconName: "catHouse" },
      { value: "apartment", label: "Apartment", icon: "🏢", iconName: "catApartment" },
      { value: "villa", label: "Villa", icon: "🏘️", iconName: "catVilla" },
      { value: "plot", label: "Plot", icon: "🗺️", iconName: "catPlot" },
      // Land, whichever way it is eventually used. Someone with a plot to sell thinks of it as
      // property long before they think of it as commercial.
      { value: "pg", label: "PG / Hostel", icon: "🛏️", iconName: "catPg" },
    ],
  },
  {
    title: "Commercial & workspace",
    options: [
      { value: "commercial", label: "Commercial space", icon: "🏬", iconName: "catCommercial" },
      { value: "coworking", label: "Coworking", icon: "💼", iconName: "catCoworking" },
      { value: "storage", label: "Storage space", icon: "📦", iconName: "catStorage" },
    ],
  },
  {
    title: "Home & furniture",
    options: [
      { value: "furniture", label: "Furniture", icon: "🛋️", iconName: "catFurniture" },
      { value: "interiors", label: "Interiors", icon: "🎨", iconName: "catInteriors" },
    ],
  },
];

/** Flat list, for anywhere that needs to look a category up rather than offer a choice. */
export const POST_CATEGORIES: PostCategoryOption[] = POST_CATEGORY_GROUPS.flatMap((g) => g.options);
