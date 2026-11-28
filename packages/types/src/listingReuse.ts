import type { ListingCategory, TransactionType } from "./index";
import { categoryFieldsFor, fieldIsVisible, pruneHiddenAttributes, type FieldDef } from "./categoryFields";
import { isMarketField, type MarketId } from "./market";

/** The seller's most recent ad in a category, for "Use details from your last ad?" on the posting form
 * (docs/plans/post-details-step-experience.md, Phase 2). Only the raw attributes travel; what is safe to reuse is
 * decided by `reuseAttributes` below. */
export interface LastListingDetailsDto {
  category: ListingCategory;
  transactionType: TransactionType;
  attributes: Record<string, unknown>;
}

/** Sections whose answers describe the seller or how they let/sell, not the particular property. Size, floor,
 * bedrooms, price and the like are NOT here: they differ from one property to the next, so copying them would
 * quietly publish a wrong fact. */
const REUSABLE_SECTIONS = new Set(["furnishing", "amenities", "preferences"]);

export function isReusableField(field: FieldDef): boolean {
  return (field.section !== undefined && REUSABLE_SECTIONS.has(field.section)) || field.key.startsWith("brokerage") || field.key === "fromBroker";
}

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
}

function asFormValue(value: unknown): string | string[] | null {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value) && value.every((v) => typeof v === "string")) return value as string[];
  return null;
}

/** Fills the blanks in `current` from `previous` for the fields that are safe to reuse. Never overwrites anything
 * the seller already entered, only copies a value the current form could hold (a select option that still exists),
 * and drops fields the new transaction type hides. Returns the merged attributes and which keys were copied. */
export function reuseAttributes(
  category: ListingCategory,
  transactionType: TransactionType,
  current: Record<string, string | string[]>,
  previous: Record<string, unknown>,
  marketId: MarketId = "in",
): { attributes: Record<string, string | string[]>; copiedKeys: string[] } {
  const merged: Record<string, string | string[]> = { ...current };
  const copiedKeys: string[] = [];
  for (const field of categoryFieldsFor(category, marketId)) {
    if (!isReusableField(field)) continue;
    if (!isMarketField(marketId, field.key)) continue;
    if (!isBlank(current[field.key])) continue;
    const value = asFormValue(previous[field.key]);
    if (value === null || isBlank(value)) continue;
    if (field.type === "select" || field.type === "multi-select") {
      const allowed = new Set(field.options?.map((o) => o.value));
      const picked = Array.isArray(value) ? value : [value];
      if (picked.some((item) => !allowed.has(item))) continue;
    }
    merged[field.key] = value;
    copiedKeys.push(field.key);
  }
  const pruned = pruneHiddenAttributes(category, transactionType, merged, marketId);
  // A copied key can disappear if a copied answer hides it (e.g. brokerage fee after "no brokerage").
  const visible = copiedKeys.filter((key) => {
    const field = categoryFieldsFor(category, marketId).find((f) => f.key === key);
    return field && fieldIsVisible(field, transactionType, pruned, marketId) && !isBlank(pruned[key]);
  });
  return { attributes: pruned, copiedKeys: visible };
}
