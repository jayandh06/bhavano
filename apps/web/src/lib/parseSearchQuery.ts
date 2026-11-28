import type { ListingCategory } from "@bhavano/types";
import { isMarketCategory } from "@bhavano/types/market";
import type { TransactionGroup } from "./seoRoute";
import { buildMarket } from "./marketRobots";

// Deliberately rule-based, not NLP — scoped to the handful of phrasings real users type into a
// classifieds search box ("2BHK in Koramangala", "furniture for sale under 5000", "PG in HSR
// Layout"), not a general query-understanding engine. Anything it can't confidently parse is left
// in `residual` for the caller to try as a locality/area name, or ultimately fall back to a plain
// text search — never a dead end.

const ALL_CATEGORY_PATTERNS: [RegExp, ListingCategory][] = [
  // US-only words first, so "townhouse" is not read as "house" and "condo apartment" is a condo. Dropped for India by the market filter below.
  [/\bcondos?\b|\bcondominiums?\b/i, "condo"],
  [/\btown\s*(houses?|homes?)\b|\brow\s+houses?\b/i, "townhouse"],
  // Before "home" and "house": a mobile or manufactured home is its own type.
  [/\b(?:manufactured|mobile|modular)\s+(?:homes?|houses?)\b/i, "manufactured"],
  // Before "apartment": an apartment building or complex is the whole thing, sold as multi-family.
  [/\bmulti[\s-]?family\b|\b(?:du|tri|four)plex(?:es)?\b|\bapartment\s+(?:buildings?|complex(?:es)?)\b/i, "multifamily"],
  // "room" is only a category when it is a room to rent: "2 bedroom" never matches (no word boundary), "room for rent" and roommate or sublet words do.
  [/\b(?:private\s+|shared\s+)?rooms?\b(?=\s+(?:for|to)\s+rent|\s+available)|\broommates?\b|\bsublets?\b/i, "room"],
  [/\b(apartments?|flats?)\b/i, "apartment"],
  [/\b(independent\s+)?houses?\b/i, "house"],
  [/\bhomes?\b/i, "house"],
  [/\bvillas?\b/i, "villa"],
  [/\bpaying\s+guests?\b/i, "pg"],
  [/\bpgs?\b/i, "pg"],
  [/\bhostels?\b/i, "pg"],
  [/\bwarehouses?\b/i, "storage"],
  [/\bgodowns?\b/i, "storage"],
  [/\bstorage\b/i, "storage"],
  [/\bco-?working\b/i, "coworking"],
  [/\bdesks?\b/i, "coworking"],
  [/\bfurnitures?\b/i, "furniture"],
  [/\bsofas?\b/i, "furniture"],
  [/\bwardrobes?\b/i, "furniture"],
  [/\binterior\s*design\b/i, "interiors"],
  [/\binteriors?\b/i, "interiors"],
  [/\bplots?\b/i, "plot"],
  [/\blands?\b/i, "plot"],
  [/\bcommercial\b/i, "commercial"],
  [/\bshops?\b/i, "commercial"],
  [/\boffice\s*spaces?\b/i, "commercial"],
];

// Only the categories this build's market has: India keeps exactly its old list (the US-only patterns drop out), and the US drops PG and the rest.
const CATEGORY_PATTERNS = ALL_CATEGORY_PATTERNS.filter(([, category]) => isMarketCategory(buildMarket().id, category));

const TRANSACTION_PATTERNS: [RegExp, TransactionGroup][] = [
  [/\bfor\s+sale\b/i, "buy"],
  [/\bto\s+buy\b/i, "buy"],
  [/\bpurchase\b/i, "buy"],
  [/\bbuy\b/i, "buy"],
  [/\bfor\s+rent\b/i, "rent-lease"],
  [/\bto\s+rent\b/i, "rent-lease"],
  [/\brentals?\b/i, "rent-lease"],
  [/\bleas(e|ing)\b/i, "rent-lease"],
  [/\brent\b/i, "rent-lease"],
];

const BEDROOM_RE = /\b(\d)\s*[- ]?\s*(?:bhk|bed(?:room)?s?)\b/i;

// The symbolic operators (>=, <=) aren't word-bounded on either side when surrounded by spaces,
// so they're matched as a separate unbounded alternative rather than inside the `\b...\b` group.
const MIN_PRICE_WORDS = /\b(above|over|more\s+than|greater\s+than)\b|>=?/i;
const MAX_PRICE_WORDS = /\b(under|below|less\s+than|up\s*to|within)\b|<=?/i;
const PRICE_NUMBER_RE = /(?:₹|rs\.?|inr)?\s*(\d[\d,]*\.?\d*)\s*(k|thousand|lakhs?|lacs?|crores?|cr)?/i;

const STOPWORDS = /\b(in|near|at|of|the|a|an)\b/gi;

function cut(text: string, match: RegExpExecArray): string {
  return (text.slice(0, match.index) + text.slice(match.index + match[0].length)).replace(/\s+/g, " ").trim();
}

function extractFirst<T>(text: string, patterns: [RegExp, T][]): { value?: T; residual: string } {
  for (const [re, value] of patterns) {
    const match = re.exec(text);
    if (match) return { value, residual: cut(text, match) };
  }
  return { residual: text };
}

function extractBedrooms(text: string): { bedrooms?: number; residual: string } {
  const match = BEDROOM_RE.exec(text);
  if (!match) return { residual: text };
  return { bedrooms: Number(match[1]), residual: cut(text, match) };
}

function priceMultiplier(suffix?: string): number {
  if (!suffix) return 1;
  const s = suffix.toLowerCase();
  if (s.startsWith("k") || s.startsWith("thousand")) return 1_000;
  if (s.startsWith("lakh") || s.startsWith("lac")) return 100_000;
  if (s.startsWith("cr")) return 10_000_000;
  return 1;
}

function extractPrice(text: string): { minPrice?: number; maxPrice?: number; residual: string } {
  let residual = text;
  let direction: "min" | "max" | undefined;

  const minMatch = MIN_PRICE_WORDS.exec(residual);
  const maxMatch = MAX_PRICE_WORDS.exec(residual);
  if (minMatch) {
    direction = "min";
    residual = cut(residual, minMatch);
  } else if (maxMatch) {
    direction = "max";
    residual = cut(residual, maxMatch);
  }

  const numberMatch = PRICE_NUMBER_RE.exec(residual);
  if (!numberMatch) return { residual };

  const raw = Number(numberMatch[1].replace(/,/g, ""));
  if (!Number.isFinite(raw)) return { residual };

  const amount = raw * priceMultiplier(numberMatch[2]);
  residual = cut(residual, numberMatch);

  return direction === "min" ? { minPrice: amount, residual } : { maxPrice: amount, residual };
}

export interface SearchIntent {
  category?: ListingCategory;
  transactionGroup?: TransactionGroup;
  bedrooms?: number;
  minPrice?: number;
  maxPrice?: number;
  /** Whatever's left after stripping every recognized token — the caller tries this against
   * known city names first, then as a locality/area name; if neither resolves, it's just noise. */
  residual: string;
}

export function parseSearchQuery(raw: string): SearchIntent {
  let text = raw.trim();
  const { value: category, residual: r1 } = extractFirst(text, CATEGORY_PATTERNS);
  text = r1;
  const { value: transactionGroup, residual: r2 } = extractFirst(text, TRANSACTION_PATTERNS);
  text = r2;
  const { bedrooms, residual: r3 } = extractBedrooms(text);
  text = r3;
  const { minPrice, maxPrice, residual: r4 } = extractPrice(text);
  text = r4;

  const residual = text.replace(STOPWORDS, " ").replace(/[,.]/g, " ").replace(/\s+/g, " ").trim();

  return { category, transactionGroup, bedrooms, minPrice, maxPrice, residual };
}
