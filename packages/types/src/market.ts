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
  /** Digits in a national number (10 in both India and the US). */
  phoneNationalLength: number;
  /** Prefix people dial before a national number at home and that is dropped on input ("0" in India, none in the US). */
  phoneTrunkPrefix: string;
  /** How validation errors name the number, e.g. "phone must be a 10-digit Indian mobile number". */
  phoneLabel: string;
  /** Placeholder for a phone input: "10-digit mobile number" in India. */
  phonePlaceholder: string;
  /** Phone numbers are the login identity here. False means email or social login leads. */
  phoneLoginPrimary: boolean;
  /** Categories that exist in this market. */
  categories: ListingCategory[];
  /** Listing and requirement field keys this market does not offer. The US drops the fields that state a preference for
   * (or against) a kind of tenant: family or bachelor, vegetarians only, gender, food. Those read as discrimination
   * under the Fair Housing Act. India has none. See docs/plans/us-market-audit-india-assumptions.md (item 13). */
  hiddenFieldKeys: readonly string[];
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
    phoneNationalLength: 10,
    phoneTrunkPrefix: "0",
    phoneLabel: "10-digit Indian mobile number",
    phonePlaceholder: "10-digit mobile number",
    phoneLoginPrimary: true,
    categories: ["house", "apartment", "villa", "pg", "storage", "coworking", "furniture", "interiors", "plot", "commercial"],
    hiddenFieldKeys: [],
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
    phoneNationalLength: 10,
    phoneTrunkPrefix: "",
    phoneLabel: "10-digit US phone number",
    phonePlaceholder: "10-digit phone number",
    phoneLoginPrimary: false,
    // Starting set plus condo, townhouse and room for rent (docs/plans/us-categories-condo-townhouse-room.md); the wedge decision in the plan may change it.
    // No PG, coworking, plots or furniture/interiors.
    categories: ["house", "apartment", "villa", "storage", "commercial", "condo", "townhouse", "room"],
    // The first four are Fair Housing; "entranceFacing" is Vastu (an India convention) and is a required field, so leaving it visible would force every US poster to pick a compass direction.
    hiddenFieldKeys: ["preferredTenantTypes", "vegetariansOnly", "gender", "foodType", "entranceFacing"],
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

/** Whole-unit digits grouped the way the market writes them: "12,50,000" in India (lakh/crore), "1,250,000" in the US.
 * Hand-rolled rather than `toLocaleString` so Node, browsers and Hermes all print the same thing. Negative keeps its sign. */
export function groupAmount(id: MarketId, amount: number): string {
  const rounded = Math.round(Math.abs(amount));
  const sign = amount < 0 && rounded > 0 ? "-" : "";
  const digits = String(rounded);
  if (digits.length <= 3) return sign + digits;
  const tail = digits.slice(-3);
  const head = digits.slice(0, -3);
  const grouped = MARKETS[id].priceInIndianWords ? head.replace(/\B(?=(\d{2})+(?!\d))/g, ",") : head.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  // The US groups the tail too: 1250000 -> head "1250" -> "1,250" + ",000".
  return `${sign}${grouped},${tail}`;
}

/** The market's currency symbol and whole-unit amount: "₹12,50,000", "$1,250". Negative: "-$1,250". */
export function formatMoney(id: MarketId, amount: number): string {
  const grouped = groupAmount(id, amount);
  return grouped.startsWith("-") ? `-${MARKETS[id].currencySymbol}${grouped.slice(1)}` : `${MARKETS[id].currencySymbol}${grouped}`;
}

/** Whether a national phone number (digits only, no dial code) is valid in the market. */
export function isValidNationalPhone(id: MarketId, digits: string): boolean {
  return MARKETS[id].phoneNationalPattern.test(digits);
}

/** The national number (digits only) from anything a person types or pastes: with or without the dial code or "+", with
 * spaces, dashes or dots, or with the home trunk prefix ("+91 98765 43210", "09876543210", "(415) 555-2671", "+1 415 555 2671").
 * Null when it is not a valid number in the market. */
export function nationalPhoneDigits(id: MarketId, raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = MARKETS[id];
  let digits = raw.replace(/\D/g, "");
  const n = m.phoneNationalLength;
  if (digits.length === n + m.phoneDialCode.length && digits.startsWith(m.phoneDialCode)) {
    digits = digits.slice(m.phoneDialCode.length);
  } else if (m.phoneTrunkPrefix && digits.length === n + m.phoneTrunkPrefix.length && digits.startsWith(m.phoneTrunkPrefix)) {
    digits = digits.slice(m.phoneTrunkPrefix.length);
  }
  return m.phoneNationalPattern.test(digits) ? digits : null;
}

/** E.164 ("+919876543210", "+14155552671") for a valid number in the market, else null. */
export function toE164(id: MarketId, raw: string | null | undefined): string | null {
  const national = nationalPhoneDigits(id, raw);
  return national ? `+${MARKETS[id].phoneDialCode}${national}` : null;
}

/** Validation message for a bad phone: "phone must be a 10-digit Indian mobile number" for India. */
export function phoneErrorMessage(id: MarketId): string {
  return `phone must be a ${MARKETS[id].phoneLabel}`;
}

/** The units a field's own list allows (`FieldDef.units`, sq ft when it names none), limited to what the market offers.
 * India offers every unit, so its lists come back unchanged; if none are left the market's default unit stands alone. */
export function marketAreaUnits(id: MarketId, units?: readonly AreaUnit[]): AreaUnit[] {
  const offered = MARKETS[id].areaUnits;
  const allowed = (units ?? ["sqft"]).filter((u) => offered.includes(u));
  return allowed.length > 0 ? allowed : [offered[0]];
}

/** Whether listings of this category can be posted in the market. */
export function isMarketCategory(id: MarketId, category: ListingCategory): boolean {
  return MARKETS[id].categories.includes(category);
}

/** Whether a listing or requirement field is offered in the market. */
export function isMarketField(id: MarketId, key: string): boolean {
  return !MARKETS[id].hiddenFieldKeys.includes(key);
}

const dateFormatters = new Map<string, Intl.DateTimeFormat>();

/** An `Intl.DateTimeFormat` in the market's locale ("en-IN" → "24 Nov 2026", "en-US" → "Nov 24, 2026"), cached by options so
 * module-level helpers can ask for it per call instead of fixing the locale at import. */
export function marketDateFormatter(id: MarketId, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${id}|${JSON.stringify(options)}`;
  let fmt = dateFormatters.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(MARKETS[id].locale, options);
    dateFormatters.set(key, fmt);
  }
  return fmt;
}
