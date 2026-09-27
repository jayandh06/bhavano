/** Indian-system rupee amounts in words — "₹35 Thousand", "₹35 Lakh", "₹1.25 Crore" — so a
 * buyer doesn't have to count digits ("₹35,00,000" vs "₹3,50,000") to tell a price apart. Used
 * for listing prices on cards/detail; the exact figure stays available separately (ListingCardDto
 * `price`) for edit forms, JSON-LD and anywhere the precise rupee amount matters.
 * See docs/plans/listing-price-in-words.md. */
export declare function formatInrInWords(amount: number): string;
