import type { MarketId } from "@bhavano/types/market";

/**
 * Parses an amount the way people actually type one into a price box — mirrors web's own
 * `parseAmount` (apps/web/src/lib/priceInput.ts) exactly, kept as its own small copy here rather
 * than a shared package: this is the whole file, not worth a cross-app refactor for.
 *
 * Accepts Indian short form ("20k", "2L", "1.5Cr") alongside plain digits, commas, spaces and a
 * leading ₹. Returns `undefined` for anything it cannot read, including a negative or
 * fractional-rupee value, so the caller can refuse rather than silently filtering on a number the
 * visitor never meant.
 */
export function parseAmount(raw: string, marketId: MarketId = "in"): number | undefined {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[₹$,\s]/g, "");
  if (!cleaned) return undefined;

  // The US writes millions ("1.5M"); India writes lakh and crore.
  const match = (marketId === "us" ? /^(\d+(?:\.\d+)?)(k|m|million)?$/ : /^(\d+(?:\.\d+)?)(k|l|lac|lacs|lakh|lakhs|cr|crore|crores)?$/).exec(cleaned);
  if (!match) return undefined;

  const [, digits, suffix] = match;
  const multiplier = suffix
    ? suffix === "k"
      ? 1_000
      : suffix.startsWith("m")
        ? 1_000_000
        : suffix.startsWith("cr")
        ? 1_00_00_000
        : 1_00_000
    : 1;

  const value = Number(digits) * multiplier;
  if (!Number.isFinite(value) || value <= 0 || !Number.isInteger(value)) return undefined;
  return value;
}
