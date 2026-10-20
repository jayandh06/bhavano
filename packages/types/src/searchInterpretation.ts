import type { ListingCategory } from "./index";
import { CATEGORY_FIELD_CONFIG } from "./categoryFields";

/** What the AI search pass hands back for one typed sentence. Every field is optional; a missing field
 * means "not stated", never "unknown". The values are the ones browse pages already accept in their
 * address (`minPrice`, `maxPrice`, `furnished`, `postedBy`, `sharingType`, `bedrooms`, `area`), so the
 * web search bar can build a normal browse URL from it. See docs/plans/ai-sentence-search.md. */
export interface SearchInterpretationDto {
  transactionGroup?: "buy" | "rent-lease";
  category?: ListingCategory;
  bedrooms?: number[];
  minPrice?: number;
  maxPrice?: number;
  furnished?: (typeof SEARCH_FURNISHED_VALUES)[number];
  postedBy?: "owner";
  sharingType?: string;
  /** A real city name from our city list. */
  cityName?: string;
  /** An area as text, spelling corrected; resolved by the destination page like any typed area. */
  areaText?: string;
  /** Short phrases from the sentence that no supported filter can express ("bachelors allowed"). */
  unmatched: string[];
}

export const SEARCH_FURNISHED_VALUES = ["unfurnished", "semi", "furnished"] as const;

const CATEGORIES: readonly ListingCategory[] = [
  "house",
  "apartment",
  "villa",
  "pg",
  "storage",
  "coworking",
  "furniture",
  "interiors",
  "plot",
  "commercial",
];

const SHARING_TYPES: readonly string[] = (CATEGORY_FIELD_CONFIG.pg.find((f) => f.key === "sharingType")?.options ?? []).map(
  (o) => o.value,
);

const MAX_PRICE = 1_000_000_000;
const MAX_BEDROOMS_LISTED = 4;
const MAX_UNMATCHED = 4;
const MAX_TEXT = 60;
/** Joining words the model sometimes returns on their own as a "leftover" - not a request at all. */
const FILLER_ONLY = /^(near|nearby|in|at|for|with|and|or|the|a|an|of|to|around|close|by)$/i;

function cleanText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.replace(/[<>{}\[\]\\"`]/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_TEXT);
  return text.length >= 2 ? text : undefined;
}

function cleanPrice(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n) || n <= 0 || n > MAX_PRICE) return undefined;
  return Math.round(n);
}

/** One-or-two-letter typo tolerance for city names (Levenshtein, no deps). */
function editDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return prev[b.length];
}

/** Names people still type for cities that were renamed; only used when the current name is in the list. */
const CITY_ALIASES: Record<string, string> = {
  bangalore: "bengaluru",
  bombay: "mumbai",
  madras: "chennai",
  calcutta: "kolkata",
  gurgaon: "gurugram",
  poona: "pune",
  trivandrum: "thiruvananthapuram",
  cochin: "kochi",
  mysore: "mysuru",
  mangalore: "mangaluru",
  vizag: "visakhapatnam",
};

export function matchCityName(raw: string, cityNames: readonly string[]): string | undefined {
  const typed = raw.trim().toLowerCase();
  const wanted = CITY_ALIASES[typed] ?? typed;
  if (!wanted) return undefined;
  const exact = cityNames.find((name) => name.toLowerCase() === wanted);
  if (exact) return exact;
  // Only fix a typo when exactly one city is that close, and only for names long enough that one
  // or two wrong letters cannot turn one real city into another.
  if (wanted.length < 5) return undefined;
  const close = cityNames.filter((name) => editDistance(name.toLowerCase(), wanted) <= (wanted.length >= 8 ? 2 : 1));
  return close.length === 1 ? close[0] : undefined;
}

/** Turns whatever the model returned into a safe SearchInterpretationDto, or null if nothing usable
 * is left. Pure and strict on purpose: the model's output is never trusted, so a confused or
 * hostile reply can at worst yield a wrong filter, never an unknown value, link or route. */
export function sanitizeSearchInterpretation(
  raw: unknown,
  ctx: { cityNames: readonly string[] },
): SearchInterpretationDto | null {
  if (!raw || typeof raw !== "object") return null;
  const input = raw as Record<string, unknown>;
  const out: SearchInterpretationDto = { unmatched: [] };

  const group = input.transactionGroup ?? input.transaction;
  if (group === "buy" || group === "rent-lease") out.transactionGroup = group;
  else if (group === "rent" || group === "lease") out.transactionGroup = "rent-lease";

  if (typeof input.category === "string" && (CATEGORIES as readonly string[]).includes(input.category)) {
    out.category = input.category as ListingCategory;
  }

  if (Array.isArray(input.bedrooms)) {
    const beds = [...new Set(input.bedrooms.map((b) => Number(b)).filter((b) => Number.isInteger(b) && b >= 1 && b <= 10))]
      .sort((a, b) => a - b)
      .slice(0, MAX_BEDROOMS_LISTED);
    if (beds.length > 0) out.bedrooms = beds;
  }

  let min = cleanPrice(input.minPrice);
  let max = cleanPrice(input.maxPrice);
  if (min !== undefined && max !== undefined && min > max) [min, max] = [max, min];
  if (min !== undefined) out.minPrice = min;
  if (max !== undefined) out.maxPrice = max;

  if (typeof input.furnished === "string" && (SEARCH_FURNISHED_VALUES as readonly string[]).includes(input.furnished)) {
    out.furnished = input.furnished as (typeof SEARCH_FURNISHED_VALUES)[number];
  }
  if (input.postedBy === "owner") out.postedBy = "owner";
  if (typeof input.sharingType === "string" && SHARING_TYPES.includes(input.sharingType)) {
    out.sharingType = input.sharingType;
  }

  const city = cleanText(input.cityName ?? input.city);
  if (city) {
    const matched = matchCityName(city, ctx.cityNames);
    if (matched) out.cityName = matched;
  }
  const area = cleanText(input.areaText ?? input.area);
  if (area) out.areaText = area;

  if (Array.isArray(input.unmatched)) {
    out.unmatched = input.unmatched
      .map((u) => cleanText(u))
      .filter((u): u is string => Boolean(u) && !FILLER_ONLY.test(u as string))
      .slice(0, MAX_UNMATCHED);
  }

  const gotAnything =
    out.transactionGroup ||
    out.category ||
    out.bedrooms ||
    out.minPrice !== undefined ||
    out.maxPrice !== undefined ||
    out.furnished ||
    out.postedBy ||
    out.sharingType ||
    out.cityName ||
    out.areaText;
  return gotAnything ? out : null;
}
