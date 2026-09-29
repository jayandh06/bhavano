import type { ListingCategory, TransactionType } from "./index";
import type { AreaUnit } from "./areaUnit";
import { type RequirementIntent } from "./requirementQuestions";
/**
 * The owner/agent Requirements tab — docs/plans/requirements-feed-for-owners-agents.md.
 *
 * One filter shape and one query codec for both ends: the web page reads its URL with it (city and
 * areas as slugs) and the BFF reads its query with it (city and areas as ids), so the two can't
 * disagree about what a filter means or how it is spelled.
 */
export type RequirementFeedMoveIn = "now" | "month" | "quarter" | "exploring";
export type RequirementFeedSort = "newest" | "soonest";
export declare const REQUIREMENT_FEED_POSTED_WITHIN_DAYS: readonly [7, 30];
export interface RequirementFeedFilters {
    /** A city slug on the web, a city id at the BFF. */
    city?: string;
    /** Area slugs on the web, area ids at the BFF. */
    areas?: string[];
    intent?: RequirementIntent;
    transactionType?: TransactionType;
    category?: ListingCategory;
    minBudget?: number;
    maxBudget?: number;
    bedrooms?: number[];
    minSqft?: number;
    maxSqft?: number;
    /** Category attribute answers, keyed like `Requirement.attributes` (not including amenities). */
    attributes?: Record<string, string[]>;
    /** Amenity keys the viewer's property has. */
    amenities?: string[];
    postedWithinDays?: number;
    moveIn?: RequirementFeedMoveIn;
    openToCalls?: boolean;
    matchesMyListings?: boolean;
    sort?: RequirementFeedSort;
}
type Query = Record<string, string | string[] | undefined>;
/**
 * Reads filters from a query. Anything unrecognised is dropped rather than refused: these URLs are
 * shared and bookmarked, and a stale value should widen the list, not break the page.
 */
export declare function decodeRequirementFeedQuery(query: Query): RequirementFeedFilters;
/** The inverse of `decodeRequirementFeedQuery`. Leaves `city` out when `includeCity` is false —
 * the web page carries the city in its path instead. */
export declare function encodeRequirementFeedQuery(f: RequirementFeedFilters, includeCity?: boolean): Record<string, string>;
export interface RequirementFeedDetail {
    label: string;
    values: string[];
}
/** One requirement as an owner or agent sees it. Carries no seeker identity and none of the
 * seeker's own words — the label is rebuilt from the structured criteria. */
export interface RequirementFeedCardDto {
    id: string;
    label: string;
    intent?: RequirementIntent;
    category: ListingCategory;
    transactionType: TransactionType;
    cityName?: string;
    areaNames: string[];
    bedroomOptions: number[];
    minPrice?: number;
    maxPrice?: number;
    /** "per month", "total price"… — what the budget is measured in. */
    budgetUnit: string;
    minAreaSqft?: number;
    maxAreaSqft?: number;
    areaUnit?: AreaUnit;
    /** Attribute answers and must-have amenities, with display labels. */
    details: RequirementFeedDetail[];
    moveInBy?: string;
    createdAt: string;
    /** Set when the seeker changed the criteria after posting. */
    updatedAt?: string;
    openToCalls: boolean;
    /** How many of the viewer's live listings fit this requirement. */
    matchingListingCount: number;
    /** Filters this card passed only because the seeker didn't answer them ("Budget not given"). */
    unanswered: string[];
}
export interface RequirementFeedCityCount {
    cityId: string;
    cityName: string;
    count: number;
}
export interface RequirementFeedDto {
    /** False for a signed-in user who isn't an owner or agent yet: the page asks which they are. */
    eligible: boolean;
    items: RequirementFeedCardDto[];
    /** Matches before the page limit. */
    total: number;
    /** Whether the viewer has live listings — the "Only ones my listings fit" toggle needs some. */
    hasListings: boolean;
    facets: {
        /** Counts under every filter except the city and its areas. */
        cities: RequirementFeedCityCount[];
        /** Within the chosen city, counts under every filter except the areas. Empty without a city. */
        areas: {
            areaId: string;
            name: string;
            count: number;
        }[];
        /** Counts within the chosen city and areas, ignoring the type filters. */
        intents: Partial<Record<RequirementIntent, number>>;
        categories: Partial<Record<ListingCategory, number>>;
    };
}
/** What anyone, signed in or not, is shown: counts only. */
export interface RequirementFeedSummaryDto {
    total: number;
    cities: RequirementFeedCityCount[];
    types: {
        intent: RequirementIntent;
        category: ListingCategory;
        count: number;
    }[];
}
export {};
