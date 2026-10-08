import type { ListingCategory, TransactionType } from "./index";
import type { AreaUnit } from "./areaUnit";
import { INTENT_CATEGORIES, REQUIREMENT_INTENTS, type RequirementIntent } from "./requirementQuestions";

/**
 * The owner/agent Requirements tab — docs/plans/requirements-feed-for-owners-agents.md.
 *
 * One filter shape and one query codec for both ends: the web page reads its URL with it (city and
 * areas as slugs) and the BFF reads its query with it (city and areas as ids), so the two can't
 * disagree about what a filter means or how it is spelled.
 */

export type RequirementFeedMoveIn = "now" | "month" | "quarter" | "exploring";
export type RequirementFeedSort = "newest" | "soonest";

export const REQUIREMENT_FEED_POSTED_WITHIN_DAYS = [7, 30] as const;

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

/** `rentLease` reads badly in a URL; everything else is its own slug. */
const INTENT_SLUGS: Record<RequirementIntent, string> = {
  buy: "buy",
  rentLease: "rent-lease",
  pg: "pg",
  coworking: "coworking",
  furniture: "furniture",
  interiors: "interiors",
};

const MOVE_INS: RequirementFeedMoveIn[] = ["now", "month", "quarter", "exploring"];
const TRANSACTIONS: TransactionType[] = ["sell", "rent", "lease"];
const ATTRIBUTE_PREFIX = "attr_";
const SLUG_LIKE = /^[a-zA-Z0-9_-]{1,80}$/;

type Query = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function list(value: string | string[] | undefined, max = 20): string[] | undefined {
  const raw = first(value);
  if (!raw) return undefined;
  const items = [...new Set(raw.split(",").map((v) => v.trim()).filter((v) => SLUG_LIKE.test(v)))].slice(0, max);
  return items.length ? items : undefined;
}

function positiveInt(value: string | string[] | undefined): number | undefined {
  const raw = first(value);
  if (!raw || !/^\d{1,12}$/.test(raw)) return undefined;
  const n = Number(raw);
  return n > 0 ? n : undefined;
}

/**
 * Reads filters from a query. Anything unrecognised is dropped rather than refused: these URLs are
 * shared and bookmarked, and a stale value should widen the list, not break the page.
 */
export function decodeRequirementFeedQuery(query: Query): RequirementFeedFilters {
  const f: RequirementFeedFilters = {};

  const city = first(query.city);
  if (city && SLUG_LIKE.test(city)) f.city = city;
  f.areas = list(query.areas, 5);

  const intentSlug = first(query.intent);
  const intent = REQUIREMENT_INTENTS.find((i) => INTENT_SLUGS[i.value] === intentSlug)?.value;
  if (intent) f.intent = intent;

  const txn = first(query.txn);
  // `buy` is what older captures said for a purchase; listings and this filter say `sell`.
  const transactionType = txn === "buy" ? "sell" : TRANSACTIONS.find((t) => t === txn);
  if (transactionType) f.transactionType = transactionType;

  const type = first(query.type) as ListingCategory | undefined;
  if (type && (intent ? INTENT_CATEGORIES[intent] : Object.values(INTENT_CATEGORIES).flat()).includes(type)) {
    f.category = type;
  }

  f.minBudget = positiveInt(query.minBudget);
  f.maxBudget = positiveInt(query.maxBudget);
  const bhk = list(query.bhk)
    ?.map(Number)
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 5);
  if (bhk?.length) f.bedrooms = bhk.sort((a, b) => a - b);
  f.minSqft = positiveInt(query.minSqft);
  f.maxSqft = positiveInt(query.maxSqft);

  const attributes: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(query)) {
    if (!key.startsWith(ATTRIBUTE_PREFIX)) continue;
    const attrKey = key.slice(ATTRIBUTE_PREFIX.length);
    const values = list(value);
    if (SLUG_LIKE.test(attrKey) && attrKey !== "amenities" && values) attributes[attrKey] = values;
  }
  if (Object.keys(attributes).length) f.attributes = attributes;
  f.amenities = list(query.amenities, 40);

  const posted = positiveInt(query.posted);
  if (posted && (REQUIREMENT_FEED_POSTED_WITHIN_DAYS as readonly number[]).includes(posted)) f.postedWithinDays = posted;
  const moveIn = MOVE_INS.find((m) => m === first(query.movein));
  if (moveIn) f.moveIn = moveIn;
  if (first(query.calls) === "1") f.openToCalls = true;
  if (first(query.matches) === "1") f.matchesMyListings = true;
  if (first(query.sort) === "soonest") f.sort = "soonest";

  for (const key of Object.keys(f) as (keyof RequirementFeedFilters)[]) {
    if (f[key] === undefined) delete f[key];
  }
  return f;
}

/** The inverse of `decodeRequirementFeedQuery`. Leaves `city` out when `includeCity` is false —
 * the web page carries the city in its path instead. */
export function encodeRequirementFeedQuery(f: RequirementFeedFilters, includeCity = true): Record<string, string> {
  const q: Record<string, string> = {};
  if (includeCity && f.city) q.city = f.city;
  if (f.areas?.length) q.areas = f.areas.join(",");
  if (f.intent) q.intent = INTENT_SLUGS[f.intent];
  if (f.transactionType) q.txn = f.transactionType;
  if (f.category) q.type = f.category;
  if (f.minBudget) q.minBudget = String(f.minBudget);
  if (f.maxBudget) q.maxBudget = String(f.maxBudget);
  if (f.bedrooms?.length) q.bhk = f.bedrooms.join(",");
  if (f.minSqft) q.minSqft = String(f.minSqft);
  if (f.maxSqft) q.maxSqft = String(f.maxSqft);
  for (const [key, values] of Object.entries(f.attributes ?? {})) {
    if (values.length) q[`${ATTRIBUTE_PREFIX}${key}`] = values.join(",");
  }
  if (f.amenities?.length) q.amenities = f.amenities.join(",");
  if (f.postedWithinDays) q.posted = String(f.postedWithinDays);
  if (f.moveIn) q.movein = f.moveIn;
  if (f.openToCalls) q.calls = "1";
  if (f.matchesMyListings) q.matches = "1";
  if (f.sort && f.sort !== "newest") q.sort = f.sort;
  return q;
}

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
    areas: { areaId: string; name: string; count: number }[];
    /** Counts within the chosen city and areas, ignoring the type filters. */
    intents: Partial<Record<RequirementIntent, number>>;
    categories: Partial<Record<ListingCategory, number>>;
  };
}

/** What anyone, signed in or not, is shown: counts only. */
export interface RequirementFeedSummaryDto {
  total: number;
  cities: RequirementFeedCityCount[];
  types: { intent: RequirementIntent; category: ListingCategory; count: number }[];
}
