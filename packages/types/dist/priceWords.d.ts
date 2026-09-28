/** Indian-system rupee amounts in words — "₹35 Thousand", "₹35 Lakh", "₹1.25 Crore" — so a
 * buyer doesn't have to count digits ("₹35,00,000" vs "₹3,50,000") to tell a price apart.
 * Everywhere a price is shown it reads number + words, "₹35,00,000 (35 Lakh)" — see
 * `formatInrWithWords` / `priceWithWords`. The exact figure alone stays available separately
 * (ListingCardDto `price`) for edit forms, JSON-LD and anywhere a parser reads it back.
 * See docs/plans/listing-price-in-words.md. */
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
/** "₹35,00,000 (35 Lakh)"; below ₹1,000 there is no word form, so just "₹500". */
export declare function formatInrWithWords(amount: number): string;
/** A budget range, number + words — "₹30,00,000 – ₹60,00,000 (30 Lakh – 60 Lakh)",
 * "up to ₹60,00,000 (60 Lakh)", "from ₹15,000 (15 Thousand)". Undefined when neither bound is set. */
export declare function formatInrRangeWithWords(min?: number | null, max?: number | null): string | undefined;
