"use strict";
/** Indian-system rupee amounts in words — "₹35 Thousand", "₹35 Lakh", "₹1.25 Crore" — so a
 * buyer doesn't have to count digits ("₹35,00,000" vs "₹3,50,000") to tell a price apart.
 * Everywhere a price is shown it reads number + words, "₹35,00,000 (35 Lakh)" — see
 * `formatInrWithWords` / `priceWithWords`. The exact figure alone stays available separately
 * (ListingCardDto `price`) for edit forms, JSON-LD and anywhere a parser reads it back.
 * See docs/plans/listing-price-in-words.md. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatInrInWords = formatInrInWords;
exports.groupInr = groupInr;
exports.priceWordsNote = priceWordsNote;
exports.priceWithWords = priceWithWords;
exports.formatInrWithWords = formatInrWithWords;
exports.formatInrRangeWithWords = formatInrRangeWithWords;
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
/** "3500000" → "35,00,000". Hand-rolled rather than `toLocaleString("en-IN")` so the grouping is
 * identical on Node, browsers and Hermes regardless of which Intl data each one ships. */
function groupInr(amount) {
    const digits = String(Math.round(Math.abs(amount)));
    const sign = amount < 0 ? "-" : "";
    if (digits.length <= 3)
        return sign + digits;
    const head = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
    return `${sign}${head},${digits.slice(-3)}`;
}
/** The bracketed half of a number + words price — "35 Lakh" for ("₹35,00,000", "₹35 Lakh"). Null
 * when the words would only repeat the number ("Contact for price", "₹500") or an older BFF sent
 * no words at all, so callers render just `price`. */
function priceWordsNote(price, priceInWords) {
    if (!priceInWords || priceInWords === price)
        return null;
    return priceInWords.replace(/^₹/, "");
}
/** "₹35,00,000 (35 Lakh)" from a listing DTO's `price` + `priceInWords` pair. */
function priceWithWords(price, priceInWords) {
    const note = priceWordsNote(price, priceInWords);
    return note ? `${price} (${note})` : price;
}
/** "₹35,00,000 (35 Lakh)"; below ₹1,000 there is no word form, so just "₹500". */
function formatInrWithWords(amount) {
    return priceWithWords(`₹${groupInr(amount)}`, formatInrInWords(amount));
}
/** A budget range, number + words — "₹30,00,000 – ₹60,00,000 (30 Lakh – 60 Lakh)",
 * "up to ₹60,00,000 (60 Lakh)", "from ₹15,000 (15 Thousand)". Undefined when neither bound is set. */
function formatInrRangeWithWords(min, max) {
    const hasMin = min !== undefined && min !== null && min > 0;
    const hasMax = max !== undefined && max !== null && max > 0;
    if (hasMin && hasMax) {
        const words = [min, max].map((n) => priceWordsNote(`₹${groupInr(n)}`, formatInrInWords(n)) ?? `₹${groupInr(n)}`);
        const numbers = `₹${groupInr(min)} – ₹${groupInr(max)}`;
        return max >= 1_000 ? `${numbers} (${words[0]} – ${words[1]})` : numbers;
    }
    if (hasMax)
        return `up to ${formatInrWithWords(max)}`;
    if (hasMin)
        return `from ${formatInrWithWords(min)}`;
    return undefined;
}
