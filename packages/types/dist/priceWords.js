"use strict";
/** Indian-system rupee amounts in words — "₹35 Thousand", "₹35 Lakh", "₹1.25 Crore" — so a
 * buyer doesn't have to count digits ("₹35,00,000" vs "₹3,50,000") to tell a price apart. Used
 * for listing prices on cards/detail; the exact figure stays available separately (ListingCardDto
 * `price`) for edit forms, JSON-LD and anywhere the precise rupee amount matters.
 * See docs/plans/listing-price-in-words.md. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatInrInWords = formatInrInWords;
const SCALES = [
    { value: 10_000_000, word: "Crore" },
    { value: 100_000, word: "Lakh" },
    { value: 1_000, word: "Thousand" },
];
/** Truncated (never rounded up) to 2 decimals, trailing zeros dropped — "35.5", "1.25", "99.99".
 * Rounding would turn ₹99,999 into "₹100 Thousand" or ₹99,99,999 into "₹100 Lakh", overstating
 * a price and printing a figure no seller typed. */
function scaled(amount, scale) {
    const hundredths = Math.floor((amount * 100) / scale + 1e-9);
    return String(hundredths / 100);
}
function formatInrInWords(amount) {
    const rounded = Math.round(amount);
    for (const { value, word } of SCALES) {
        if (rounded >= value)
            return `₹${scaled(rounded, value)} ${word}`;
    }
    return `₹${rounded}`;
}
