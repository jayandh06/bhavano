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
    /** Search engines may index this market's pages. False until the market is launched. */
    indexable: boolean;
}
export declare const MARKETS: Record<MarketId, MarketConfig>;
/** The market every existing deployment and every caller that names none uses. */
export declare const DEFAULT_MARKET_ID: MarketId;
export declare function isMarketId(value: unknown): value is MarketId;
/** The config for a market id, falling back to India for anything unknown or missing so an unset or
 * mistyped value can never change India's behaviour. */
export declare function getMarket(id?: string | null): MarketConfig;
/** Which market a URL path belongs to: "/us" and "/us/..." are the US, everything else (including "/usa-tools" or
 * "/") is India, so no existing India path is ever claimed. */
export declare function marketFromPath(pathname: string): MarketId;
/** A path inside the market: India is unchanged, the US is under /us. Input should start with "/". */
export declare function marketPath(id: MarketId, path: string): string;
/** The path without its market prefix ("/us/austin-tx/rent" becomes "/austin-tx/rent"). */
export declare function stripMarketPrefix(pathname: string): string;
/** Whole-unit digits grouped the way the market writes them: "12,50,000" in India (lakh/crore), "1,250,000" in the US.
 * Hand-rolled rather than `toLocaleString` so Node, browsers and Hermes all print the same thing. Negative keeps its sign. */
export declare function groupAmount(id: MarketId, amount: number): string;
/** The market's currency symbol and whole-unit amount: "₹12,50,000", "$1,250". Negative: "-$1,250". */
export declare function formatMoney(id: MarketId, amount: number): string;
/** Whether a national phone number (digits only, no dial code) is valid in the market. */
export declare function isValidNationalPhone(id: MarketId, digits: string): boolean;
/** The national number (digits only) from anything a person types or pastes: with or without the dial code or "+", with
 * spaces, dashes or dots, or with the home trunk prefix ("+91 98765 43210", "09876543210", "(415) 555-2671", "+1 415 555 2671").
 * Null when it is not a valid number in the market. */
export declare function nationalPhoneDigits(id: MarketId, raw: string | null | undefined): string | null;
/** E.164 ("+919876543210", "+14155552671") for a valid number in the market, else null. */
export declare function toE164(id: MarketId, raw: string | null | undefined): string | null;
/** Validation message for a bad phone: "phone must be a 10-digit Indian mobile number" for India. */
export declare function phoneErrorMessage(id: MarketId): string;
/** The units a field's own list allows (`FieldDef.units`, sq ft when it names none), limited to what the market offers.
 * India offers every unit, so its lists come back unchanged; if none are left the market's default unit stands alone. */
export declare function marketAreaUnits(id: MarketId, units?: readonly AreaUnit[]): AreaUnit[];
/** Whether listings of this category can be posted in the market. */
export declare function isMarketCategory(id: MarketId, category: ListingCategory): boolean;
