"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST_CATEGORIES = exports.POST_CATEGORY_GROUPS = void 0;
exports.marketPostCategoryGroups = marketPostCategoryGroups;
const market_1 = require("./market");
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
exports.POST_CATEGORY_GROUPS = [
    {
        title: "Property",
        options: [
            { value: "house", label: "House", icon: "🏡", iconName: "catHouse" },
            { value: "apartment", label: "Apartment", icon: "🏢", iconName: "catApartment" },
            { value: "villa", label: "Villa", icon: "🏘️", iconName: "catVilla" },
            // US-only (not in India's market category list, so India's picker is unchanged): they reuse the existing icons.
            { value: "condo", label: "Condo / Co-op", icon: "🏙️", iconName: "catApartment" },
            { value: "townhouse", label: "Townhouse", icon: "🏠", iconName: "catHouse" },
            { value: "room", label: "Room for rent", icon: "🛏️", iconName: "catPg" },
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
    // "Home & furniture" (Furniture, Interiors) deliberately hidden for now — low inventory, and
    // the focus is on core real estate first. Not removed from ListingCategory/the Prisma enum, so
    // existing listings and their browse pages keep working exactly as before; this only stops new
    // ones from being posted via this picker. See docs/plans/furniture-interiors-paused.md.
];
/** Flat list, for anywhere that needs to look a category up rather than offer a choice. */
exports.POST_CATEGORIES = exports.POST_CATEGORY_GROUPS.flatMap((g) => g.options);
/** The category groups offered in the posting wizard in this market: only categories the market has, and no empty group.
 * India's list is `POST_CATEGORY_GROUPS` without the US-only categories, which is exactly what it offered before they were added. */
function marketPostCategoryGroups(id) {
    return exports.POST_CATEGORY_GROUPS.map((g) => ({ ...g, options: g.options.filter((o) => (0, market_1.isMarketCategory)(id, o.value)) })).filter((g) => g.options.length > 0);
}
