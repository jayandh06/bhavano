import type { ListingCategory, TransactionType } from "./index";
import { areaUnitShortLabel, type AreaUnit } from "./areaUnit";
import { PRICE_ON_REQUEST_CATEGORIES } from "./priceQualifiers";
import { formatInrWithWords, groupInr } from "./priceWords";

export interface PriceBounds {
  min: number;
  max: number;
}

export interface CategoryPriceBounds {
  sale: PriceBounds;
  rental: PriceBounds;
}

/** Rough plausibility bounds per category (INR) Ã¢ÂÂ originally just a fat-finger/scam-price
 * defense at posting time (see apps/bff/src/moderation/priceBounds.ts), also reused by the web
 * app to build category-aware price quick-picks on browse pages. Sale = buy/sell, rental =
 * rent/lease. Tune as real submissions come in. */
export const PRICE_BOUNDS: Record<ListingCategory, CategoryPriceBounds> = {
  house: { sale: { min: 100_000, max: 500_000_000 }, rental: { min: 1_000, max: 1_000_000 } },
  apartment: { sale: { min: 100_000, max: 500_000_000 }, rental: { min: 1_000, max: 1_000_000 } },
  villa: { sale: { min: 100_000, max: 500_000_000 }, rental: { min: 1_000, max: 1_000_000 } },
  pg: { sale: { min: 100_000, max: 500_000_000 }, rental: { min: 1_000, max: 100_000 } },
  storage: { sale: { min: 100_000, max: 500_000_000 }, rental: { min: 200, max: 100_000 } },
  coworking: { sale: { min: 100_000, max: 500_000_000 }, rental: { min: 500, max: 200_000 } },
  furniture: { sale: { min: 50, max: 1_000_000 }, rental: { min: 50, max: 50_000 } },
  // Sell-only (see POSTABLE_TRANSACTION_TYPES) Ã¢ÂÂ the `rental` bound is never actually reached.
  interiors: { sale: { min: 500, max: 5_000_000 }, rental: { min: 500, max: 5_000_000 } },
  // Sell-only Ã¢ÂÂ land spans the same price range as built residential property. `rental` mirrors
  // `sale` (never reached), same pattern as `interiors` above.
  plot: { sale: { min: 100_000, max: 500_000_000 }, rental: { min: 100_000, max: 500_000_000 } },
  // A small shop and a large warehouse are both "commercial", hence the wide rental band. `sale`
  // shares the standard real-estate-sale band used by every other sellable category.
  commercial: { sale: { min: 100_000, max: 500_000_000 }, rental: { min: 5_000, max: 2_000_000 } },
};

/**
 * Why a listing's price can't be posted, or null. Always judged on the total stored in
 * `Listing.price`, never on a per-unit figure: ₹12,500 per sq ft is a normal house rate, and the
 * ₹1 lakh minimum is for the whole property. When the seller priced per unit, pass what they
 * typed so the message can show the working. Shared by the BFF (the authority) and both post
 * forms, which check before the preview so a seller never learns this after uploading photos.
 */
export function listingPriceIssue(
  category: ListingCategory,
  transactionType: TransactionType,
  total: number,
  perUnit?: { price: number; area: number; unit: AreaUnit },
): string | null {
  if (total === 0 && PRICE_ON_REQUEST_CATEGORIES.has(category)) return null;
  const bounds = PRICE_BOUNDS[category][transactionType === "buy" || transactionType === "sell" ? "sale" : "rental"];
  if (total >= bounds.min && total <= bounds.max) return null;
  const range = `${formatInrWithWords(bounds.min)} to ${formatInrWithWords(bounds.max)}`;
  if (!perUnit) return `Price ${formatInrWithWords(total)} is outside the expected range (${range}) for this category`;
  const unit = areaUnitShortLabel(perUnit.unit, 1);
  return (
    `₹${groupInr(perUnit.price)}/${unit} × ${groupInr(perUnit.area)} ${areaUnitShortLabel(perUnit.unit, perUnit.area)} ` +
    `comes to ${formatInrWithWords(total)}, outside the expected range (${range}) for this category. ` +
    `Check the price per ${unit} and the area.`
  );
}

/**
 * Why a requirement's budget figure can't be used, or null — a floor-only check, deliberately not
 * the ceiling `listingPriceIssue` enforces: a seeker's upper budget can legitimately run well
 * above what a typical listing in this category asks (see
 * docs/plans/requirement-refinement-questions.md's own note on why PRICE_BOUNDS was originally
 * left out of requirement validation entirely — its ceiling governs what a listing may ask, not
 * what a seeker may offer, but its floor is a different question: a value below it, like ₹7/month
 * for an apartment, was never a real budget either way). minPrice/maxPrice are optional on a
 * requirement, so this is only ever called when a value is actually given.
 */
export function requirementBudgetIssue(category: ListingCategory, transactionType: TransactionType, value: number): string | null {
  const bounds = PRICE_BOUNDS[category][transactionType === "buy" || transactionType === "sell" ? "sale" : "rental"];
  if (value >= bounds.min) return null;
  return `₹${groupInr(value)} is below the typical range for this category (starts around ${formatInrWithWords(bounds.min)})`;
}
