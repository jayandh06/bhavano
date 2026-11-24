import type { AreaUnit } from "./areaUnit";
import type { ListingCategory } from "./index";

/**
 * A market is one country Bhavano serves: its currency, locale, time zone, units, phone rules and which
 * categories exist. Everything that used to be a hardcoded India assumption (`Asia/Kolkata`, `en-IN`,
 * `country:in`, the 10-digit phone rule, the rupee symbol) reads it from here instead.
 *
 * India is the default and its values reproduce today's behaviour exactly, so reading the market config
 * never changes what India sees. The US entry is the launch configuration for bhavano.com/us; nothing
 * consumes it until the US stack exists. See docs/plans/us-market-expansion.md and
 * docs/plans/us-market-audit-india-assumptions.md.
 */
export type MarketId = "in" | "us";

export interface MarketConfig {
  id: MarketId;
  /** ISO 3166-1 alpha-2, upper case: Google Places `components=country:`, structured data `addressCountry`,
   * the `ipCountry` stored on a Visit. */
  countryCode: "IN" | "US";
  name: string;
  /** URL path prefix the market lives under on www.bhavano.com. India stays at the root (""), so its URLs
   * never change; the US lives under "/us". */
  pathPrefix: "" | "/us";
  /** ISO 4217. */
  currency: "INR" | "USD";
  currencySymbol: string;
  /** BCP 47 locale for number, date and currency formatting. */
  locale: "en-IN" | "en-US";
  /** IANA time zone used for scheduled jobs, "today" boundaries and displayed times. The US spans several
   * zones; this is the zone of the market's business day, not of each viewer. */
  timeZone: string;
  /** Whether prices may be written with lakh/crore words (India only). */
  priceInIndianWords: boolean;
  /** Units offered for a listing's area, first is the default. */
  areaUnits: AreaUnit[];
  /** Calling code without "+". */
  phoneDialCode: string;
  /** National-number pattern a phone input must match (digits only, after the dial code is removed). */
  phoneNationalPattern: RegExp;
  /** Phone numbers are the login identity here. False means email or social login leads. */
  phoneLoginPrimary: boolean;
  /** Categories that exist in this market. */
  categories: ListingCategory[];
  /** Search engines may index this market's pages. False until the market is launched. */
  indexable: boolean;
}

export const MARKETS: Record<MarketId, MarketConfig> = {
  in: {
    id: "in",
    countryCode: "IN",
    name: "India",
    pathPrefix: "",
    currency: "INR",
    currencySymbol: "₹",
    locale: "en-IN",
    timeZone: "Asia/Kolkata",
    priceInIndianWords: true,
    areaUnits: ["sqft", "sqm", "acre", "hectare", "cent"],
    phoneDialCode: "91",
    phoneNationalPattern: /^[6-9]\d{9}$/,
    phoneLoginPrimary: true,
    categories: ["house", "apartment", "villa", "pg", "storage", "coworking", "furniture", "interiors", "plot", "commercial"],
    indexable: true,
  },
  us: {
    id: "us",
    countryCode: "US",
    name: "United States",
    pathPrefix: "/us",
    currency: "USD",
    currencySymbol: "$",
    locale: "en-US",
    // Business-day zone for jobs; per-user zones come later (see the plan).
    timeZone: "America/New_York",
    priceInIndianWords: false,
    areaUnits: ["sqft", "acre"],
    phoneDialCode: "1",
    phoneNationalPattern: /^[2-9]\d{2}[2-9]\d{6}$/,
    phoneLoginPrimary: false,
    // Starting set; the wedge decision in the plan may change it. No PG, coworking, plots or furniture/interiors.
    categories: ["house", "apartment", "villa", "storage", "commercial"],
    indexable: false,
  },
};

/** The market every existing deployment and every caller that names none uses. */
export const DEFAULT_MARKET_ID: MarketId = "in";

export function isMarketId(value: unknown): value is MarketId {
  return value === "in" || value === "us";
}

/** The config for a market id, falling back to India for anything unknown or missing so an unset or
 * mistyped value can never change India's behaviour. */
export function getMarket(id?: string | null): MarketConfig {
  return isMarketId(id) ? MARKETS[id] : MARKETS[DEFAULT_MARKET_ID];
}

/** Which market a URL path belongs to: "/us" and "/us/..." are the US, everything else (including "/usa-tools" or
 * "/") is India, so no existing India path is ever claimed. */
export function marketFromPath(pathname: string): MarketId {
  const p = pathname.split("?")[0].split("#")[0];
  return p === "/us" || p.startsWith("/us/") ? "us" : DEFAULT_MARKET_ID;
}

/** A path inside the market: India is unchanged, the US is under /us. Input should start with "/". */
export function marketPath(id: MarketId, path: string): string {
  const prefix = MARKETS[id].pathPrefix;
  if (!prefix) return path;
  return path === "/" ? prefix : `${prefix}${path}`;
}

/** The path without its market prefix ("/us/austin-tx/rent" becomes "/austin-tx/rent"). */
export function stripMarketPrefix(pathname: string): string {
  if (marketFromPath(pathname) !== "us") return pathname;
  const rest = pathname.slice("/us".length);
  return rest === "" ? "/" : rest;
}

/** Formats an amount in the market's currency and locale, whole units (no paise or cents). */
export function formatMoney(id: MarketId, amount: number): string {
  const m = MARKETS[id];
  return new Intl.NumberFormat(m.locale, { style: "currency", currency: m.currency, maximumFractionDigits: 0 }).format(amount);
}

/** Whether a national phone number (digits only, no dial code) is valid in the market. */
export function isValidNationalPhone(id: MarketId, digits: string): boolean {
  return MARKETS[id].phoneNationalPattern.test(digits);
}
