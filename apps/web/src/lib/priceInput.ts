import { formatINR } from "./seoRoute";

/**
 * Parses an amount the way people actually type one into a price box.
 *
 * The quick-pick brackets are written in Indian short form ("Under ₹25k", "₹20L – ₹2Cr"), so an
 * input beside them has to accept the same notation — someone reading "₹2L" on a chip and typing
 * `2L` into the box below it is not doing anything unusual. Commas, spaces and a leading ₹ are
 * accepted for the same reason: `1,00,000` and `₹1 lakh` are both ordinary ways to write it.
 *
 * Returns `undefined` for anything it cannot read, including a negative or fractional-rupee value,
 * so the caller can refuse to navigate rather than silently filtering on a number the visitor
 * never meant.
 */
export function parseAmount(raw: string): number | undefined {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[₹,\s]/g, "");
  if (!cleaned) return undefined;

  const match = /^(\d+(?:\.\d+)?)(k|l|lac|lacs|lakh|lakhs|cr|crore|crores)?$/.exec(cleaned);
  if (!match) return undefined;

  const [, digits, suffix] = match;
  const multiplier = suffix
    ? suffix === "k"
      ? 1_000
      : suffix.startsWith("cr")
        ? 1_00_00_000
        : 1_00_000
    : 1;

  const value = Number(digits) * multiplier;
  // Rupees, not paise: a price of ₹2.5 is not a thing anyone is filtering for, and a fractional
  // bound would round differently in the heading than in the query.
  if (!Number.isFinite(value) || value <= 0 || !Number.isInteger(value)) return undefined;
  return value;
}

/** The pill's label for a range no quick-pick bracket matches — "₹20k – ₹2L", "Above ₹20k",
 * "Under ₹45k". Without it a custom range left the pill reading "Price", which looked like no
 * filter was applied at all. */
export function customPriceLabel(minPrice?: number, maxPrice?: number): string | undefined {
  if (minPrice !== undefined && maxPrice !== undefined) return `${formatINR(minPrice)} – ${formatINR(maxPrice)}`;
  if (maxPrice !== undefined) return `Under ${formatINR(maxPrice)}`;
  if (minPrice !== undefined) return `Above ${formatINR(minPrice)}`;
  return undefined;
}
