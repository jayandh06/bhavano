/** Indian-system rupee amounts in words — "₹35 Thousand", "₹35 Lakh", "₹1.25 Crore" — so a
 * buyer doesn't have to count digits ("₹35,00,000" vs "₹3,50,000") to tell a price apart.
 * Detail pages, the seller's own screens and admin read number + words, "₹35,00,000 (35 Lakh)"
 * (`priceWithWords`); browse cards and share text just "₹35 Lakh" (`compactPrice`). A per-unit
 * price leads with the listing's total (`listingHeadlinePrice`). The exact figure alone stays available separately
 * (ListingCardDto `price`) for edit forms, JSON-LD and anywhere a parser reads it back.
 * See docs/plans/listing-price-in-words.md. */

import type { ListingTotalPriceDto } from "./index";
import { formatArea, type AreaUnit } from "./areaUnit";

const SCALES: ReadonlyArray<{ value: number; word: string }> = [
  { value: 10_000_000, word: "Crore" },
  { value: 100_000, word: "Lakh" },
  { value: 1_000, word: "Thousand" },
];

/** Truncated (never rounded up) to 2 decimals, trailing zeros dropped — "35.5", "1.25", "99.99".
 * Rounding would turn ₹99,999 into "₹100 Thousand" or ₹99,99,999 into "₹100 Lakh", overstating
 * a price and printing a figure no seller typed. */
function scaled(amount: number, scale: number): string {
  const hundredths = Math.floor((amount * 100) / scale + 1e-9);
  return String(hundredths / 100);
}

export function formatInrInWords(amount: number): string {
  const rounded = Math.round(amount);
  for (const { value, word } of SCALES) {
    if (rounded >= value) return `₹${scaled(rounded, value)} ${word}`;
  }
  return `₹${rounded}`;
}

/** "3500000" → "35,00,000". Hand-rolled rather than `toLocaleString("en-IN")` so the grouping is
 * identical on Node, browsers and Hermes regardless of which Intl data each one ships. */
export function groupInr(amount: number): string {
  const digits = String(Math.round(Math.abs(amount)));
  const sign = amount < 0 ? "-" : "";
  if (digits.length <= 3) return sign + digits;
  const head = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${sign}${head},${digits.slice(-3)}`;
}

/** The bracketed half of a number + words price — "35 Lakh" for ("₹35,00,000", "₹35 Lakh"). Null
 * when the words would only repeat the number ("Contact for price", "₹500") or an older BFF sent
 * no words at all, so callers render just `price`. */
export function priceWordsNote(price: string, priceInWords?: string | null): string | null {
  if (!priceInWords || priceInWords === price) return null;
  return priceInWords.replace(/^₹/, "");
}

/** "₹35,00,000 (35 Lakh)" from a listing DTO's `price` + `priceInWords` pair. */
export function priceWithWords(price: string, priceInWords?: string | null): string {
  const note = priceWordsNote(price, priceInWords);
  return note ? `${price} (${note})` : price;
}

/** What a browse card or share message leads with: the words from ₹1 lakh up ("₹60 Lakh"), where
 * counting digits is what goes wrong, and the plain number below that ("₹23,500"), where
 * "₹23.5 Thousand" would read worse than the digits. Detail pages, the seller's own screens and
 * admin show the exact figure too (`priceWithWords`). */
export function compactPrice(price: string, priceInWords?: string | null): string {
  return priceInWords && /\b(Lakh|Crore)\b/.test(priceInWords) ? priceInWords : price;
}

/** A per-unit listing's `totalPrice` — the whole-rupee total and the area it was multiplied out
 * over. Built the same way by the BFF and by the post wizard's preview card. */
export function perUnitTotalPrice(total: number, area: number, unit: AreaUnit): ListingTotalPriceDto {
  return { price: `₹${groupInr(total)}`, priceInWords: formatInrInWords(total), area: formatArea(area, unit) };
}

export interface ListingPriceFields {
  price: string;
  priceInWords?: string | null;
  totalPrice?: ListingTotalPriceDto | null;
}

/** The price a listing leads with. A per-unit price leads with the whole listing's total and keeps
 * the rate as a second line — { price: "₹60,00,000", priceInWords: "₹60 Lakh",
 * rate: "₹5,000/sq ft · 1,200 sq ft" }. Any other listing has no rate line. */
export function listingHeadlinePrice(item: ListingPriceFields): {
  price: string;
  priceInWords?: string | null;
  rate: string | null;
} {
  if (!item.totalPrice) return { price: item.price, priceInWords: item.priceInWords, rate: null };
  return {
    price: item.totalPrice.price,
    priceInWords: item.totalPrice.priceInWords,
    rate: `${item.price} · ${item.totalPrice.area}`,
  };
}

/** The whole price on one line of plain text: `compact` for share messages ("₹60 Lakh"), `full`
 * for lists and tables ("₹60,00,000 (60 Lakh)"), each followed by the rate for a per-unit price. */
export function listingPriceText(item: ListingPriceFields, style: "compact" | "full"): string {
  const headline = listingHeadlinePrice(item);
  const main =
    style === "compact"
      ? compactPrice(headline.price, headline.priceInWords)
      : priceWithWords(headline.price, headline.priceInWords);
  return headline.rate ? `${main} · ${headline.rate}` : main;
}

/** "₹35,00,000 (35 Lakh)"; below ₹1,000 there is no word form, so just "₹500". */
export function formatInrWithWords(amount: number): string {
  return priceWithWords(`₹${groupInr(amount)}`, formatInrInWords(amount));
}

/** A budget range, number + words — "₹30,00,000 – ₹60,00,000 (30 Lakh – 60 Lakh)",
 * "up to ₹60,00,000 (60 Lakh)", "from ₹15,000 (15 Thousand)". Undefined when neither bound is set. */
export function formatInrRangeWithWords(min?: number | null, max?: number | null): string | undefined {
  const hasMin = min !== undefined && min !== null && min > 0;
  const hasMax = max !== undefined && max !== null && max > 0;
  if (hasMin && hasMax) {
    const words = [min, max].map((n) => priceWordsNote(`₹${groupInr(n)}`, formatInrInWords(n)) ?? `₹${groupInr(n)}`);
    const numbers = `₹${groupInr(min)} – ₹${groupInr(max)}`;
    return max >= 1_000 ? `${numbers} (${words[0]} – ${words[1]})` : numbers;
  }
  if (hasMax) return `up to ${formatInrWithWords(max)}`;
  if (hasMin) return `from ${formatInrWithWords(min)}`;
  return undefined;
}
