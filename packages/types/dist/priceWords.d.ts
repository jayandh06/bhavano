/** Indian-system rupee amounts in words — "₹35 Thousand", "₹35 Lakh", "₹1.25 Crore" — so a
 * buyer doesn't have to count digits ("₹35,00,000" vs "₹3,50,000") to tell a price apart.
 * Detail pages, the seller's own screens and admin read number + words, "₹35,00,000 (35 Lakh)"
 * (`priceWithWords`); browse cards and share text just "₹35 Lakh" (`compactPrice`). A per-unit
 * price leads with the listing's total (`listingHeadlinePrice`). The exact figure alone stays available separately
 * (ListingCardDto `price`) for edit forms, JSON-LD and anywhere a parser reads it back.
 * See docs/plans/listing-price-in-words.md. */
import type { ListingTotalPriceDto } from "./index";
import { type AreaUnit } from "./areaUnit";
export declare function formatInrInWords(amount: number): string;
/** "3500000" → "35,00,000". Hand-rolled rather than `toLocaleString("en-IN")` so the grouping is
 * identical on Node, browsers and Hermes regardless of which Intl data each one ships. */
export declare function groupInr(amount: number): string;
/** The bracketed half of a number + words price — "35 Lakh" for ("₹35,00,000", "₹35 Lakh"). Null
 * when the words would only repeat the number ("Contact for price", "₹500") or an older BFF sent
 * no words at all, so callers render just `price`. */
export declare function priceWordsNote(price: string, priceInWords?: string | null): string | null;
/** "₹35,00,000 (35 Lakh)" from a listing DTO's `price` + `priceInWords` pair. */
export declare function priceWithWords(price: string, priceInWords?: string | null): string;
/** What a browse card or share message leads with: the words from ₹1 lakh up ("₹60 Lakh"), where
 * counting digits is what goes wrong, and the plain number below that ("₹23,500"), where
 * "₹23.5 Thousand" would read worse than the digits. Detail pages, the seller's own screens and
 * admin show the exact figure too (`priceWithWords`). */
export declare function compactPrice(price: string, priceInWords?: string | null): string;
/** A per-unit listing's `totalPrice` — the whole-rupee total and the area it was multiplied out
 * over. Built the same way by the BFF and by the post wizard's preview card. */
export declare function perUnitTotalPrice(total: number, area: number, unit: AreaUnit): ListingTotalPriceDto;
export interface ListingPriceFields {
    price: string;
    priceInWords?: string | null;
    totalPrice?: ListingTotalPriceDto | null;
}
/** The price a listing leads with. A per-unit price leads with the whole listing's total and keeps
 * the rate as a second line — { price: "₹60,00,000", priceInWords: "₹60 Lakh",
 * rate: "₹5,000/sq ft · 1,200 sq ft" }. Any other listing has no rate line. */
export declare function listingHeadlinePrice(item: ListingPriceFields): {
    price: string;
    priceInWords?: string | null;
    rate: string | null;
};
/** The whole price on one line of plain text: `compact` for share messages ("₹60 Lakh"), `full`
 * for lists and tables ("₹60,00,000 (60 Lakh)"), each followed by the rate for a per-unit price. */
export declare function listingPriceText(item: ListingPriceFields, style: "compact" | "full"): string;
/** "₹35,00,000 (35 Lakh)"; below ₹1,000 there is no word form, so just "₹500". */
export declare function formatInrWithWords(amount: number): string;
/** A budget range, number + words — "₹30,00,000 – ₹60,00,000 (30 Lakh – 60 Lakh)",
 * "up to ₹60,00,000 (60 Lakh)", "from ₹15,000 (15 Thousand)". Undefined when neither bound is set. */
export declare function formatInrRangeWithWords(min?: number | null, max?: number | null): string | undefined;
