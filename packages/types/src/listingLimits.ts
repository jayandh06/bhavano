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

/**
 * Digits allowed in a price. 8 caps input at ₹99,99,999 — just under a crore.
 *
 * NOTE: this is deliberately tighter than `PRICE_BOUNDS` in priceBounds.ts, which the BFF
 * enforces and which allows up to ₹50 crore for a property sale. A genuine high-end sale is
 * therefore acceptable to the server but cannot be typed into the form. Raise this to 9 if that
 * starts costing real listings — the server already permits it.
 */
export const PRICE_MAX_DIGITS = 8;
export const MAX_PRICE = 10 ** PRICE_MAX_DIGITS - 1;

/** Keeps only the leading `maxDigits` characters. Browsers do not stop someone typing past
 * `<input max>`, so the value has to be truncated as it is entered rather than validated after. */
export function clampDigits(value: string, maxDigits: number | undefined): string {
  if (maxDigits === undefined) return value;
  return value.slice(0, maxDigits);
}
