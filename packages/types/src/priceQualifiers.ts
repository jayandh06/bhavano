import type { ListingCategory, TransactionType } from "./index";

export interface PriceQualifierOption {
  value: string;
  label: string;
}

/** "" (Fixed price) is a deliberately valid, selectable option for sell listings — it submits
 * as a blank priceQualifier, matching pre-existing sell listings that show no suffix at all. */
const SELL_OPTIONS: PriceQualifierOption[] = [
  { value: "", label: "Fixed price" },
  { value: "onwards", label: "Onwards" },
  { value: "negotiable", label: "Negotiable" },
];

const MONTHLY_OPTIONS: PriceQualifierOption[] = [{ value: "/month", label: "Per month" }];

/** Lease is offered as its own transaction type, distinct from (and alongside) Rent — Rent is
 * already the monthly-recurring case, so Lease's own price is a lump sum valid for the whole
 * term, not a rate. First/default option is deliberately NOT worded "per lease term": "per"
 * reads as a recurring rate (like "per month"), which is exactly the wrong signal for a one-time
 * amount that covers the entire term and isn't paid again until it's renewed. `/month` stays
 * offered, not removed, for a lease that genuinely is quoted as a monthly rent over a fixed term
 * (common for commercial leases) — just no longer the default. */
const LEASE_TERM_OPTION: PriceQualifierOption = { value: "for lease term", label: "For the lease term" };
const LEASE_OPTIONS: PriceQualifierOption[] = [LEASE_TERM_OPTION, { value: "/month", label: "Per month" }];

/** PG plans commonly run shorter than a month (a trial week, a per-day short stay) or vary enough
 * by sharing type that the owner wants to signal "starting from" rather than a single fixed rate
 * — see PRICE_ON_REQUEST_CATEGORIES's own note on why PG/coworking pricing doesn't fit one number
 * cleanly. `onwards` mirrors SELL_OPTIONS' same qualifier below, just offered here too. */
const PG_RENT_OPTIONS: PriceQualifierOption[] = [
  { value: "/month", label: "Per month" },
  { value: "/week", label: "Per week" },
  { value: "/day", label: "Per day" },
  { value: "onwards", label: "Onwards" },
];

const COWORKING_RENT_OPTIONS: PriceQualifierOption[] = [
  { value: "/seat/month", label: "Per seat / month" },
  { value: "/month", label: "Per month (whole space)" },
  { value: "/week", label: "Per week" },
  { value: "/day", label: "Per day" },
  { value: "onwards", label: "Onwards" },
];

const FURNITURE_RENT_OPTIONS: PriceQualifierOption[] = [
  { value: "/day", label: "Per day" },
  { value: "/month", label: "Per month" },
];

/** Every option a poster may pick for a given (category, transactionType), keyed to match
 * `POSTABLE_TRANSACTION_TYPES` in postingRules.ts — the single source of truth the wizard's
 * step-3 price qualifier dropdown, the edit form, and the BFF's validation all read from. */
export const PRICE_QUALIFIER_OPTIONS: Record<ListingCategory, Partial<Record<TransactionType, PriceQualifierOption[]>>> = {
  house: { sell: SELL_OPTIONS, rent: MONTHLY_OPTIONS, lease: LEASE_OPTIONS },
  apartment: { sell: SELL_OPTIONS, rent: MONTHLY_OPTIONS, lease: LEASE_OPTIONS },
  villa: { sell: SELL_OPTIONS, rent: MONTHLY_OPTIONS, lease: LEASE_OPTIONS },
  pg: { rent: PG_RENT_OPTIONS },
  storage: { rent: MONTHLY_OPTIONS, lease: LEASE_OPTIONS },
  // Lease here keeps the per-seat/per-month options too (a coworking lease is still commonly
  // billed that way) — just with the lease-term lump sum offered first, as the default.
  coworking: { rent: COWORKING_RENT_OPTIONS, lease: [LEASE_TERM_OPTION, ...COWORKING_RENT_OPTIONS] },
  furniture: { sell: SELL_OPTIONS, rent: FURNITURE_RENT_OPTIONS },
  interiors: { sell: SELL_OPTIONS },
  plot: { sell: SELL_OPTIONS },
  commercial: { sell: SELL_OPTIONS, rent: MONTHLY_OPTIONS, lease: LEASE_OPTIONS },
};

export function getPriceQualifierOptions(
  category: ListingCategory,
  transactionType: TransactionType,
): PriceQualifierOption[] {
  return PRICE_QUALIFIER_OPTIONS[category]?.[transactionType] ?? [];
}

/** Categories where `price: 0` ("Contact for price") is a legitimate posting — plans/pricing
 * vary enough (PG sharing type, coworking seat type) that no single number is always honest.
 * Single source of truth: `ListingsService.assertValidPrice` enforces this server-side, and
 * PostAdWizard/EditListingForm (web + mobile) gate their own "can I submit?" checks on the same
 * set, so a client-side validity gate can never silently disagree with what the API accepts. */
export const PRICE_ON_REQUEST_CATEGORIES: ReadonlySet<ListingCategory> = new Set<ListingCategory>([
  "pg",
  "coworking",
]);
