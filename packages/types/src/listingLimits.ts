import type { TransactionType } from "./index";

/**
 * Input limits for the listing-level fields — title and price — that live on the listing itself
 * rather than in a category's attribute set.
 *
 * Shared so the posting wizard, the edit form and the mobile app cannot disagree. A cap enforced
 * only where a listing is created is not a cap: whatever it rejects can still be typed on the
 * edit screen the next minute.
 */

/** Titles render as one line on a listing card. 150 is generous for that and short enough that
 * the whole thing stays readable without truncation. */
export const TITLE_MAX_LENGTH = 150;

/** ₹20 crore. */
export const MAX_PRICE_SALE = 200_000_000;

/** ₹10 lakh — a monthly figure, not a total. */
export const MAX_PRICE_RENTAL = 1_000_000;

/**
 * The most a price field will accept, by what the listing is for.
 *
 * A single ceiling could not serve both: one high enough for a ₹20 crore sale lets a rent of the
 * same magnitude through unnoticed, and a typo there is far likelier than the sale it permits.
 * Grouped the same way the URL grammar groups them — buy/sell against rent/lease.
 *
 * Both are deliberately tighter than `PRICE_BOUNDS` in priceBounds.ts, which the BFF enforces:
 *
 * - Sale there allows ₹50 crore for property. A form is where a slipped keypad turns 2 crore
 *   into 20, so the narrower bound belongs here; the server stays the backstop.
 * - Rental there is per category, and commercial rent allows ₹20 lakh. A commercial letting above
 *   ₹10 lakh a month is therefore acceptable to the server but cannot be typed. Rare enough to be
 *   worth the simpler rule, and the number to raise if it ever costs a listing.
 */
export function maxPriceFor(transactionType: TransactionType): number {
  return transactionType === "buy" || transactionType === "sell" ? MAX_PRICE_SALE : MAX_PRICE_RENTAL;
}

/**
 * Clamps a price as it is typed.
 *
 * By value rather than by digit count, because neither ceiling falls on a power of ten: capping
 * ₹20 crore at 9 digits would wave through ₹99 crore, and ₹10 lakh at 7 digits would allow ₹99
 * lakh. Every prefix of a valid number is itself under the cap, so typing forwards is never
 * interrupted — only a value that actually exceeds it gets pulled back.
 */
export function clampPrice(value: string, transactionType: TransactionType | null | undefined): string {
  const digits = value.replace(/[^0-9]/g, "").replace(/^0+(?=\d)/, "");
  if (digits === "" || transactionType == null) return digits;
  const max = maxPriceFor(transactionType);
  return Number(digits) > max ? String(max) : digits;
}

/** Keeps only the leading `maxDigits` characters. Browsers do not stop someone typing past
 * `<input max>`, so the value has to be truncated as it is entered rather than validated after. */
export function clampDigits(value: string, maxDigits: number | undefined): string {
  if (maxDigits === undefined) return value;
  return value.slice(0, maxDigits);
}
