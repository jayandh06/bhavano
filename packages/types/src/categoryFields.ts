import type { ListingCategory, TransactionType } from "./index";
import type { AreaUnit } from "./areaUnit";
import { groupInr } from "./priceWords";

export interface FieldOption {
  value: string;
  label: string;
}

/** Section a field is grouped under in the posting/editing UI — each renders as its own
 * accordion with a header from `SECTION_LABELS`. Order of display follows `SECTION_ORDER`,
 * not declaration order in a category's field list. */
export type FieldSection =
  | "basics"
  | "pricing"
  | "preferences"
  | "furnishing"
  | "amenities"
  | "roomDetails"
  | "spaceDetails"
  | "workspaceDetails"
  | "itemDetails"
  | "serviceDetails"
  | "plotDetails";

export const SECTION_LABELS: Record<FieldSection, string> = {
  basics: "Property details",
  pricing: "Pricing & fees",
  preferences: "Tenant preferences",
  furnishing: "Furnishing details",
  amenities: "Amenities",
  roomDetails: "Room details",
  spaceDetails: "Space details",
  workspaceDetails: "Workspace details",
  itemDetails: "Item details",
  serviceDetails: "Service details",
  plotDetails: "Plot details",
};

/** Fixed display order for sections — independent of the order fields are declared in a
 * category's array, so a field can be added anywhere without reshuffling its section's
 * position in the UI. */
export const SECTION_ORDER: FieldSection[] = [
  // "plotDetails" ahead of "pricing" is deliberate and only affects Plot (no other category has
  // a "plotDetails" field) — Plot's price-per-unit toggle reads the area unit chosen here, so the
  // seller needs to reach this section before the toggle's "Price per <unit>" label means anything.
  "plotDetails",
  "pricing",
  "basics",
  "roomDetails",
  "spaceDetails",
  "workspaceDetails",
  "itemDetails",
  "serviceDetails",
  "preferences",
  "furnishing",
  "amenities",
];

export interface FieldDef {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "multi-select" | "area";
  options?: FieldOption[];
  placeholder?: string;
  min?: number;
  /** Upper bound for a `number` field, checked by the BFF and the forms alike (a percentage). */
  max?: number;
  /** `number` only: accepts up to 2 decimal places instead of whole numbers only (a percentage
   * like 1.5). Such a field shouldn't set `maxDigits`, which counts the "." as a digit. */
  decimal?: boolean;
  /** `type: "area"` only — which units this field's number can be entered in. A single-entry
   * list (or omitted entirely) renders as a plain sqft number input, visually identical to every
   * other numeric field; more than one renders a unit dropdown alongside the number. Only Plot
   * and Commercial get more than `["sqft"]` — carpet/size areas for the other categories are
   * never measured in acres/cents/hectares in practice. The chosen unit is stored in a sibling
   * attribute key, `${key}Unit` (absent = "sqft", covering every pre-existing listing with no
   * backfill — see docs/plans/multiple-area-units-price-per-unit.md). */
  units?: AreaUnit[];
  /** `type: "text"` only — renders in a normal grid cell instead of spanning the full row.
   * Text fields default to full width (room for a website URL, an amenities list, etc.); set
   * this on short fields like plot dimensions ("30 x 40 ft") that read fine at half width and
   * pair naturally alongside the field before/after them. */
  compact?: boolean;
  /** A single emoji shown next to the label in both the posting form and the listing detail
   * page — set on amenity/furnishing fields, where a quick visual scan matters more than for a
   * plain count or select. Not required elsewhere. */
  /** Emoji. Still here because the app renders this field as text and has no SVG support —
   * see `iconName`, which the web app uses instead. */
  icon?: string;
  /** A key into the web app's outlined icon set. String, not a union: the icon set is a web
   * concern and this package must not depend on it. */
  iconName?: string;
  /** Caps a `number` field's input to this many digits — e.g. a bedroom/bathroom/appliance
   * count never needs more than 2 (max 99), unlike a currency amount or an area in sqft, which
   * are left unrestricted (`undefined`). Enforced by truncating keystrokes past the limit, not
   * just `<input max>`, since browsers don't stop someone typing a 3rd digit on their own. */
  maxDigits?: number;
  /** Render as a −/+ stepper rather than a bare number box. For small counts the buttons are
   * faster than a keyboard and they are visible on every device, unlike `<input type=number>`
   * spinners, which browsers show only on hover on desktop and not at all on a phone. */
  stepper?: boolean;
  /** Seeded into a new listing's attributes when its category is chosen. Only counts use this:
   * "how many bedrooms" starting at 0 is a real answer and lets the stepper work from a number,
   * whereas an empty price or area would be a guess presented as fact. */
  defaultValue?: string;
  transactionTypes?: TransactionType[];
  section?: FieldSection;
  /** Field is only shown once `attributes[dependsOn.key] === dependsOn.value` — e.g. a
   * broker-fee amount only makes sense once "brokerage fee applicable" is answered "yes".
   * Chains are supported (A gates B gates C); `pruneHiddenAttributes` below keeps a
   * hidden link's stale value from leaking into a still-visible descendant. */
  dependsOn?: { key: string; value: string };
  /** A second gate that only applies on the listed transaction types — e.g. the brokerage ₹
   * amount waits for "Fixed amount" on a sale, but on rent/lease (fixed amount only, no type
   * question) it follows "Has brokerage fee" alone. */
  alsoDependsOn?: { key: string; value: string; transactionTypes: TransactionType[] };
  /** Must be filled in before the listing can be posted/saved — enforced in both the
   * posting wizard/edit form (disables submit) and the BFF (`ListingsService`). */
  required?: boolean;
}

/** Single source of truth for whether a field should be shown, given the current transaction
 * type and in-progress attribute values — used by the posting wizard, the edit form, and the
 * listing detail page so all three agree on what's visible. */
export function fieldIsVisible(
  field: FieldDef,
  transactionType: TransactionType,
  attributes: Record<string, unknown>,
): boolean {
  return (
    (!field.transactionTypes ||
      field.transactionTypes.includes(transactionType)) &&
    (!field.dependsOn ||
      attributes[field.dependsOn.key] === field.dependsOn.value) &&
    (!field.alsoDependsOn ||
      !field.alsoDependsOn.transactionTypes.includes(transactionType) ||
      attributes[field.alsoDependsOn.key] === field.alsoDependsOn.value)
  );
}

/** Groups an already-visibility-filtered field list into sections, ordered per
 * `SECTION_ORDER` (fields without a `section` land in a trailing "other" bucket). Generic so
 * it works over plain `FieldDef`s (the forms) or `{ section, ... }` display tuples (the
 * listing detail page). */
export function groupFieldsBySection<F extends { section?: FieldSection }>(
  fields: F[],
): { section: FieldSection | "other"; label: string; fields: F[] }[] {
  const buckets = new Map<FieldSection | "other", F[]>();
  for (const field of fields) {
    const section = field.section ?? "other";
    const bucket = buckets.get(section);
    if (bucket) bucket.push(field);
    else buckets.set(section, [field]);
  }
  const ordered: (FieldSection | "other")[] = [...SECTION_ORDER, "other"];
  return ordered
    .filter((section) => buckets.has(section))
    .map((section) => ({
      section,
      label: section === "other" ? "Other details" : SECTION_LABELS[section],
      fields: buckets.get(section)!,
    }));
}

/** Strips any attribute whose field is no longer visible (its `dependsOn` condition broke,
 * possibly several links back in a chain) — run after every attribute/transaction-type change
 * so a hidden field's stale value can't linger and reappear if a descendant field depends on
 * it. Iterates to a fixpoint since hiding one field can cascade to hide the next. */
export function pruneHiddenAttributes(
  category: ListingCategory,
  transactionType: TransactionType,
  attributes: Record<string, string | string[]>,
): Record<string, string | string[]> {
  const next = { ...attributes };
  const fields = CATEGORY_FIELD_CONFIG[category];
  let removedAny = true;
  while (removedAny) {
    removedAny = false;
    for (const field of fields) {
      if (
        field.key in next &&
        !fieldIsVisible(field, transactionType, next)
      ) {
        delete next[field.key];
        // `type: "area"` fields carry a second, sibling attribute key for the chosen unit —
        // see FieldDef.units's own doc comment. No area field is conditional today, but a
        // future one that hides its number must not leave its unit behind as an orphan.
        if (field.type === "area") delete next[`${field.key}Unit`];
        removedAny = true;
      }
    }
  }
  return next;
}

/**
 * Why a filled-in `number` / `area` value is invalid, or null. Shared by the BFF's
 * `assertValidAttributes` and `listingAttributesIssue` so the forms and the server word and draw
 * the line identically. Accepts the raw form string or the BFF's already-normalized number.
 */
export function numberFieldIssue(field: FieldDef, value: unknown): string | null {
  const text = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  const numberValue = text === "" ? NaN : Number(text);
  const min = field.min ?? 0;
  // Unlike a plain `number` field, an area's value isn't required to be a whole number — 2.5
  // acres is a completely ordinary answer, unlike "2.5 bedrooms".
  if (field.type === "area") {
    return Number.isFinite(numberValue) && numberValue >= min
      ? null
      : `${field.label} must be a number of at least ${min}`;
  }
  const inRange =
    Number.isFinite(numberValue) && numberValue >= min && (field.max === undefined || numberValue <= field.max);
  if (field.decimal) {
    return inRange && /^\d+(\.\d{1,2})?$/.test(text)
      ? null
      : field.max === undefined
        ? `${field.label} must be a number of at least ${min}, up to 2 decimal places`
        : `${field.label} must be between ${min} and ${field.max}, up to 2 decimal places`;
  }
  return inRange && Number.isInteger(numberValue)
    ? null
    : field.max === undefined
      ? `${field.label} must be a whole number of at least ${min}`
      : `${field.label} must be a whole number from ${min} to ${field.max}`;
}

const CONDITIONAL_FEE_KEYS = ["maintenanceFeeApplicable"] as const;

/**
 * The first reason the BFF's `assertValidAttributes` would reject these attributes, in its own
 * words, or null. The post-ad forms use it to keep Preview disabled instead of letting the seller
 * reach Post ad and fail there ("Total floors in building must be a whole number of at least 1").
 * Only visible fields are checked; hidden ones are pruned before submit. `price` (the total, or
 * the monthly rent) adds the brokerage-against-price limits. Keep in step with
 * ListingsService.assertValidAttributes / assertConditionalFee / assertBrokerageFitsPrice.
 */
export function listingAttributesIssue(
  category: ListingCategory,
  transactionType: TransactionType,
  attributes: Record<string, string | string[]>,
  price?: number | null,
): string | null {
  const fields = CATEGORY_FIELD_CONFIG[category];
  for (const field of fields) {
    if (!fieldIsVisible(field, transactionType, attributes)) continue;
    const value = attributes[field.key];
    if (value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) {
      if (field.required) return `${field.label} is required`;
      continue;
    }
    if (field.type === "number" || field.type === "area") {
      const issue = numberFieldIssue(field, value);
      if (issue) return issue;
    } else if (field.type === "select" || field.type === "multi-select") {
      const allowed = new Set(field.options?.map((option) => option.value));
      const picked = Array.isArray(value) ? value : [value];
      if (picked.some((item) => !allowed.has(item))) return `Pick ${field.label} again`;
    }
  }
  for (const applicableKey of CONDITIONAL_FEE_KEYS) {
    if (attributes[applicableKey] !== "yes") continue;
    const amountField = fields.find(
      (field) =>
        field.dependsOn?.key === applicableKey &&
        field.dependsOn.value === "yes" &&
        (!field.transactionTypes || field.transactionTypes.includes(transactionType)),
    );
    if (!amountField) continue;
    const amount = attributes[amountField.key];
    if (typeof amount !== "string" || amount.trim() === "") return `${amountField.label} is required`;
  }
  return brokerageFeeIssue(transactionType, price, attributes);
}

/** The attributes a freshly-chosen category starts with — the counts, at zero. Called instead
 * of resetting to an empty object so a stepper has a number to increment from and the form opens
 * with honest answers rather than blanks the poster has to fill in to say "none". */
export function defaultAttributesFor(category: ListingCategory): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of CATEGORY_FIELD_CONFIG[category]) {
    if (field.defaultValue !== undefined) out[field.key] = field.defaultValue;
  }
  return out;
}

/** Floor picker for house / apartment / villa — keep labels human ("2nd") and values stable
 * (`"2"`) for filters and detail display. Caps at 50; taller towers use Top. */
function floorOrdinalLabel(n: number): string {
  const mod100 = n % 100;
  const mod10 = n % 10;
  const suffix =
    mod100 >= 11 && mod100 <= 13 ? "th" : mod10 === 1 ? "st" : mod10 === 2 ? "nd" : mod10 === 3 ? "rd" : "th";
  return `${n}${suffix}`;
}

const RESIDENTIAL_FLOOR_OPTIONS: FieldOption[] = [
  { value: "basement", label: "Basement" },
  { value: "ground", label: "Ground" },
  ...Array.from({ length: 50 }, (_, i) => {
    const n = i + 1;
    return { value: String(n), label: floorOrdinalLabel(n) };
  }),
  { value: "top", label: "Top floor" },
];

export const BROKERAGE_FEE_FIXED = "fixed";
export const BROKERAGE_FEE_PERCENT = "percent";
const BROKERAGE_SELL_MAX_PERCENT = 5;
const BROKERAGE_SELL_MIN_RUPEES = 1_000;
const BROKERAGE_RENT_MAX_MONTHS = 2;
const BROKERAGE_RENT_MIN_RUPEES = 500;

/**
 * The brokerage block every broker-capable category (residential, plot, commercial) shares, after
 * its own `fromBroker` field. On a sale the broker picks how the fee is quoted before entering it
 * — a flat ₹ amount or a % of the sale price — and each quoting style keeps its own key, so
 * neither the BFF nor the detail page has to guess whether a stored number means ₹ or %. Rent and
 * lease brokerage is quoted in months of rent, never as a %, so there it is a ₹ amount with no
 * type question. The ranges that depend on the listing's price live in `brokerageFeeIssue`.
 * Sale listings stored before `brokerageFeeType` existed get it inferred from whichever amount
 * they hold (`normalizeBrokerageAttributes`).
 */
const BROKERAGE_FIELDS: FieldDef[] = [
  {
    key: "brokerageFeeApplicable",
    label: "Has brokerage fee",
    type: "select",
    section: "pricing",
    dependsOn: { key: "fromBroker", value: "yes" },
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
  },
  {
    key: "brokerageFeeType",
    label: "Brokerage fee type",
    type: "select",
    section: "pricing",
    transactionTypes: ["sell"],
    dependsOn: { key: "brokerageFeeApplicable", value: "yes" },
    options: [
      { value: BROKERAGE_FEE_FIXED, label: "Fixed amount" },
      { value: BROKERAGE_FEE_PERCENT, label: "% of sale price" },
    ],
    required: true,
  },
  {
    key: "brokerageFee",
    label: "Brokerage Fee (₹)",
    type: "number",
    min: BROKERAGE_RENT_MIN_RUPEES,
    maxDigits: 9,
    section: "pricing",
    dependsOn: { key: "brokerageFeeApplicable", value: "yes" },
    alsoDependsOn: { key: "brokerageFeeType", value: BROKERAGE_FEE_FIXED, transactionTypes: ["sell"] },
    required: true,
  },
  {
    key: "brokerageCommissionPercent",
    label: "Brokerage Fee (%)",
    type: "number",
    decimal: true,
    min: 0.25,
    max: BROKERAGE_SELL_MAX_PERCENT,
    section: "pricing",
    transactionTypes: ["sell"],
    dependsOn: { key: "brokerageFeeType", value: BROKERAGE_FEE_PERCENT },
    required: true,
  },
];

/**
 * Brokerage in the shape the fields above expect. A sale payload from before the type question
 * (an old app build, or a listing stored before it) gets `brokerageFeeType` from whichever amount
 * it holds; rent/lease drops the type, since those are always a ₹ amount now.
 */
export function normalizeBrokerageAttributes(
  transactionType: TransactionType,
  attributes: Record<string, unknown>,
): Record<string, unknown> {
  if (transactionType === "sell") return inferBrokerageFeeType(attributes);
  if (!("brokerageFeeType" in attributes)) return attributes;
  const rest = { ...attributes };
  delete rest.brokerageFeeType;
  return rest;
}

/** Whole rupees the fixed brokerage may reach: 5% of the sale price, or 2 months of rent. */
function brokerageFeeCap(transactionType: TransactionType, price: number): { rupees: number; basis: string } {
  return transactionType === "sell"
    ? { rupees: Math.floor((price * BROKERAGE_SELL_MAX_PERCENT) / 100), basis: `${BROKERAGE_SELL_MAX_PERCENT}% of the price` }
    : { rupees: price * BROKERAGE_RENT_MAX_MONTHS, basis: `${BROKERAGE_RENT_MAX_MONTHS} months' rent` };
}

function brokerageUsesFixedAmount(transactionType: TransactionType, attributes: Record<string, unknown>): boolean {
  return transactionType !== "sell" || attributes.brokerageFeeType === BROKERAGE_FEE_FIXED;
}

/**
 * Why the brokerage ₹ amount is out of line with the listing's price, or null. Sits on top of the
 * fields' own min/max (which already hold the % to 0.25–5): a sale's fee is ₹1,000 up to 5% of the
 * price, a rent/lease fee up to 2 months' rent. `price` is the listing's total — the monthly rent
 * for rent/lease — and a missing or zero price skips the ceiling. Shared by the forms and the BFF.
 * See docs/plans/residential-rent-buy-details.md.
 */
export function brokerageFeeIssue(
  transactionType: TransactionType,
  price: number | null | undefined,
  attributes: Record<string, unknown>,
): string | null {
  if (attributes.brokerageFeeApplicable !== "yes" || !brokerageUsesFixedAmount(transactionType, attributes)) {
    return null;
  }
  if (!isFilled(attributes.brokerageFee)) return null;
  const fee = Number(attributes.brokerageFee);
  if (!Number.isFinite(fee)) return null;
  if (transactionType === "sell" && fee < BROKERAGE_SELL_MIN_RUPEES) {
    return `Brokerage Fee (₹) must be at least ₹${groupInr(BROKERAGE_SELL_MIN_RUPEES)} on a sale`;
  }
  if (!price || price <= 0) return null;
  const cap = brokerageFeeCap(transactionType, price);
  return fee > cap.rupees ? `Brokerage Fee (₹) can be at most ₹${groupInr(cap.rupees)} (${cap.basis})` : null;
}

/**
 * A line shown under the brokerage amount while it is being typed: what a % comes to in rupees
 * ("≈ ₹1,30,000 of ₹65,00,000"), or the most a ₹ amount may be. Null with no price to go on.
 */
export function brokerageFeeNote(
  transactionType: TransactionType,
  price: number | null | undefined,
  attributes: Record<string, unknown>,
): { key: string; text: string } | null {
  if (attributes.brokerageFeeApplicable !== "yes" || !price || price <= 0) return null;
  if (brokerageUsesFixedAmount(transactionType, attributes)) {
    const cap = brokerageFeeCap(transactionType, price);
    return { key: "brokerageFee", text: `Up to ₹${groupInr(cap.rupees)} (${cap.basis})` };
  }
  if (attributes.brokerageFeeType !== BROKERAGE_FEE_PERCENT) return null;
  const percent = Number(attributes.brokerageCommissionPercent);
  if (!isFilled(attributes.brokerageCommissionPercent) || !Number.isFinite(percent)) return null;
  return {
    key: "brokerageCommissionPercent",
    text: `≈ ₹${groupInr((price * percent) / 100)} of ₹${groupInr(price)}`,
  };
}

/** Fills in `brokerageFeeType` for a sale payload from before the type question — picked from
 * whichever amount is present. Leaves the attributes untouched when the type is already set or
 * can't be told. */
export function inferBrokerageFeeType(
  attributes: Record<string, unknown>,
): Record<string, unknown> {
  if (attributes.brokerageFeeApplicable !== "yes" || isFilled(attributes.brokerageFeeType)) {
    return attributes;
  }
  if (isFilled(attributes.brokerageFee)) {
    return { ...attributes, brokerageFeeType: BROKERAGE_FEE_FIXED };
  }
  if (isFilled(attributes.brokerageCommissionPercent)) {
    return { ...attributes, brokerageFeeType: BROKERAGE_FEE_PERCENT };
  }
  return attributes;
}

function isFilled(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.length > 0;
  return String(value).trim() !== "";
}

const RESIDENTIAL_FIELDS: FieldDef[] = [
  {
    key: "bedrooms",
    label: "Bedrooms",
    type: "number",
    required: true,
    maxDigits: 2,
    stepper: true,
    defaultValue: "0",
    section: "basics",
  },
  {
    key: "bathrooms",
    label: "Bathrooms",
    type: "number",
    required: true,
    maxDigits: 2,
    stepper: true,
    defaultValue: "0",
    section: "basics",
  },
  {
    // Structured (not free text like commercial `floor`) so browse filters can match later.
    // Required since 30 Sept; listings posted before then may omit it, and are asked for it on
    // their next edit. Sell/rent/lease all share this; no transactionTypes gate. Values:
    // basement / ground / 1…50 / top.
    key: "floor",
    label: "Floor",
    type: "select",
    section: "basics",
    options: RESIDENTIAL_FLOOR_OPTIONS,
    required: true,
  },
  {
    // Required alongside `floor` (30 Sept). No defaultValue: 1 would be a guess for a flat.
    key: "totalFloors",
    label: "Total floors in building",
    type: "number",
    min: 1,
    maxDigits: 2,
    stepper: true,
    section: "basics",
    required: true,
  },
  {
    key: "carpetAreaSqft",
    label: "Carpet area (sqft)",
    type: "number",
    maxDigits: 5,
    min: 1,
    required: true,
    section: "basics",
  },
  {
    key: "furnished",
    label: "Furnishing",
    type: "select",
    section: "basics",
    options: [
      { value: "unfurnished", label: "Unfurnished" },
      { value: "semi", label: "Semi-furnished" },
      { value: "furnished", label: "Furnished" },
    ],
  },
  {
    key: "balconyCount",
    label: "Balcony count",
    type: "number",
    min: 0,
    maxDigits: 2,
    stepper: true,
    defaultValue: "0",
    section: "basics",
  },
  {
    key: "openParkingCount",
    label: "Open parking",
    type: "number",
    min: 0,
    maxDigits: 2,
    stepper: true,
    defaultValue: "0",
    section: "basics",
  },
  {
    key: "closedParkingCount",
    label: "Closed parking",
    type: "number",
    min: 0,
    maxDigits: 2,
    stepper: true,
    defaultValue: "0",
    section: "basics",
  },
  {
    key: "entranceFacing",
    label: "Entrance facing",
    type: "select",
    section: "basics",
    required: true,
    options: [
      { value: "north", label: "North" },
      { value: "south", label: "South" },
      { value: "east", label: "East" },
      { value: "west", label: "West" },
      { value: "north-east", label: "North-East" },
      { value: "north-west", label: "North-West" },
      { value: "south-east", label: "South-East" },
      { value: "south-west", label: "South-West" },
    ],
  },
  {
    key: "gatedCommunity",
    label: "Gated community",
    type: "select",
    section: "basics",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
  },
  {
    key: "gasPipeline",
    label: "Gas pipeline",
    type: "select",
    section: "basics",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
  },
  {
    // "Negotiable" is already one of the Price Qualifier's own options for sell listings (see
    // SELL_OPTIONS in priceQualifiers.ts) — restricted to rent/lease here so the two can't say
    // conflicting things (qualifier "Fixed price" + this toggle "Yes") for the same listing.
    key: "priceNegotiable",
    label: "Price negotiable",
    type: "select",
    section: "pricing",
    transactionTypes: ["rent", "lease"],
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
  },
  {
    key: "fromBroker",
    label: "Posted by Broker / Agent",
    type: "select",
    section: "pricing",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
  },
  ...BROKERAGE_FIELDS,
  {
    key: "maintenanceFeeApplicable",
    label: "Has monthly maintenance?",
    type: "select",
    section: "pricing",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
  },
  {
    key: "monthlyMaintenanceFee",
    label: "Maintenance fee (₹)",
    type: "number",
    maxDigits: 5,
    min: 0,
    section: "pricing",
    dependsOn: { key: "maintenanceFeeApplicable", value: "yes" },
  },
  {
    key: "preferredTenantTypes",
    label: "Preferred tenant type",
    type: "multi-select",
    section: "preferences",
    transactionTypes: ["rent", "lease"],
    options: [
      { value: "family", label: "Family" },
      { value: "company", label: "Company" },
      { value: "bachelor", label: "Bachelor" },
    ],
  },
  {
    key: "petsAllowed",
    label: "Pets allowed",
    type: "select",
    section: "preferences",
    transactionTypes: ["rent", "lease"],
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
  },
  {
    key: "vegetariansOnly",
    label: "Vegetarians only",
    type: "select",
    section: "preferences",
    transactionTypes: ["rent", "lease"],
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
    // Defaults to "No" (no restriction) — the overwhelming common case, and unlike a guessed
    // price/area (see `defaultValue`'s own doc comment above) a wrong default here costs the
    // lister one click to correct rather than misstating a fact about the property itself.
    defaultValue: "no",
  },
  {
    key: "washingMachineCount",
    label: "Washing machines",
    type: "number",
    min: 0,
    maxDigits: 2,
    icon: "🧺",
    iconName: "washingMachine",
    section: "furnishing",
    dependsOn: { key: "furnished", value: "furnished" },
  },
  {
    key: "sofaCount",
    label: "Sofas",
    type: "number",
    min: 0,
    maxDigits: 2,
    icon: "🛋️",
    iconName: "sofa",
    section: "furnishing",
    dependsOn: { key: "furnished", value: "furnished" },
  },
  {
    key: "stoveCount",
    label: "Stoves",
    type: "number",
    min: 0,
    maxDigits: 2,
    icon: "🍳",
    iconName: "stove",
    section: "furnishing",
    dependsOn: { key: "furnished", value: "furnished" },
  },
  {
    key: "fridgeCount",
    label: "Fridges",
    type: "number",
    min: 0,
    maxDigits: 2,
    icon: "❄️",
    iconName: "fridge",
    section: "furnishing",
    dependsOn: { key: "furnished", value: "furnished" },
  },
  {
    key: "cupboardCount",
    label: "Cupboards",
    type: "number",
    min: 0,
    maxDigits: 2,
    icon: "🚪",
    iconName: "cupboard",
    section: "furnishing",
    dependsOn: { key: "furnished", value: "furnished" },
  },
  {
    key: "fanCount",
    label: "Fans",
    type: "number",
    min: 0,
    maxDigits: 2,
    icon: "🌀",
    iconName: "fan",
    section: "furnishing",
    dependsOn: { key: "furnished", value: "furnished" },
  },
  {
    key: "lightCount",
    label: "Lights",
    type: "number",
    min: 0,
    maxDigits: 2,
    icon: "💡",
    iconName: "light",
    section: "furnishing",
    dependsOn: { key: "furnished", value: "furnished" },
  },
  {
    key: "bedCount",
    label: "Beds",
    type: "number",
    min: 0,
    maxDigits: 2,
    icon: "🛏️",
    iconName: "bedSingle",
    section: "furnishing",
    dependsOn: { key: "furnished", value: "furnished" },
  },
  {
    key: "tvCount",
    label: "TVs",
    type: "number",
    min: 0,
    maxDigits: 2,
    icon: "📺",
    iconName: "tv",
    section: "furnishing",
    dependsOn: { key: "furnished", value: "furnished" },
  },
  {
    key: "geyserCount",
    label: "Geysers",
    type: "number",
    min: 0,
    maxDigits: 2,
    icon: "🚿",
    iconName: "geyser",
    section: "furnishing",
    dependsOn: { key: "furnished", value: "furnished" },
  },
  {
    key: "tableCount",
    label: "Tables",
    type: "number",
    min: 0,
    maxDigits: 2,
    icon: "🪑",
    iconName: "table",
    section: "furnishing",
    dependsOn: { key: "furnished", value: "furnished" },
  },
  {
    key: "diningTableCount",
    label: "Dining tables",
    type: "number",
    min: 0,
    maxDigits: 2,
    icon: "🍽️",
    iconName: "diningTable",
    section: "furnishing",
    dependsOn: { key: "furnished", value: "furnished" },
  },
  ...[
    ["cctv", "CCTV", "📹", "cctv"],
    ["lift", "Lift", "🛗", "lift"],
    ["powerBackup", "Power backup", "🔋", "powerBackup"],
    ["waterSupply", "Water supply", "🚰", "waterSupply"],
    ["playArea", "Play area", "🎠", "playArea"],
    ["gym", "Gym", "🏋️", "gym"],
    ["swimmingPool", "Swimming pool", "🏊", "swimmingPool"],
    ["clubHouse", "Club house", "🏛️", "clubHouse"],
  ].map(([key, label, icon, iconName]) => ({
    key,
    label,
    icon,
    iconName,
    type: "select" as const,
    section: "amenities" as const,
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
  })),
];

/** One field-def list per category — the single source of truth for both the posting
 * wizard's dynamic step-3 form and the `attributes` JSONB column it maps onto. Adding a
 * future category means adding an entry here, not a new form/code path. */
export const CATEGORY_FIELD_CONFIG: Record<ListingCategory, FieldDef[]> = {
  house: RESIDENTIAL_FIELDS,
  apartment: RESIDENTIAL_FIELDS,
  villa: RESIDENTIAL_FIELDS,
  pg: [
    {
      // Multi-select, not select — a PG can genuinely offer more than one sharing type at once
      // (e.g. single + double + triple in the same property). See
      // backfillSharingTypeMultiSelect.ts for the one-off data fix this required, same pattern
      // as `gender` below.
      key: "sharingType",
      label: "Sharing type",
      type: "multi-select",
      section: "roomDetails",
      options: [
        { value: "single", label: "Single" },
        { value: "double", label: "Double sharing" },
        { value: "triple", label: "Triple sharing" },
        { value: "dormitory", label: "Dormitory" },
      ],
      required: true,
    },
    {
      // Multi-select, not select — a PG can genuinely take more than one (e.g. co-living: coed
      // + men + women all at once). See get_pg_coworking_leads.py's build_contact() for the
      // scraper-side keyword heuristic that pre-fills this from the business name.
      key: "gender",
      label: "Preferred for",
      type: "multi-select",
      section: "roomDetails",
      options: [
        { value: "men", label: "Men" },
        { value: "women", label: "Women" },
        { value: "coed", label: "Co-ed" },
      ],
    },
    {
      key: "meals",
      label: "Meals included",
      type: "select",
      section: "roomDetails",
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ],
    },
    {
      key: "website",
      label: "Website (optional)",
      type: "text",
      section: "roomDetails",
      placeholder: "https://yourpg.com",
    },
    {
      key: "twoWheelerParking",
      label: "Two-wheeler parking",
      type: "select",
      icon: "🛵",
      iconName: "twoWheelerParking",
      section: "amenities",
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ],
    },
    {
      key: "fourWheelerParking",
      label: "Four-wheeler parking",
      type: "select",
      icon: "🚗",
      iconName: "fourWheelerParking",
      section: "amenities",
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ],
    },
    {
      key: "tv",
      label: "TV",
      type: "select",
      icon: "📺",
      iconName: "tv",
      section: "amenities",
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ],
    },
    {
      key: "internet",
      label: "Internet / WiFi",
      type: "select",
      icon: "📶",
      iconName: "internet",
      section: "amenities",
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ],
      // No default — unlike coworking, whether a PG actually has WiFi varies enough that
      // defaulting it would risk stating a fact that isn't true, rather than just costing a click.
    },
    {
      key: "attachedBathroom",
      label: "Attached bathroom",
      type: "select",
      icon: "🚿",
      iconName: "attachedBathroom",
      section: "amenities",
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ],
    },
    {
      key: "ac",
      label: "AC",
      type: "select",
      icon: "❄️",
      iconName: "ac",
      section: "amenities",
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ],
    },
    {
      key: "laundryService",
      label: "Laundry service",
      type: "select",
      icon: "🧺",
      iconName: "laundryService",
      section: "amenities",
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ],
    },
    {
      key: "powerBackup",
      label: "Power backup",
      type: "select",
      icon: "🔋",
      iconName: "powerBackup",
      section: "amenities",
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ],
    },
    {
      key: "cctv",
      label: "CCTV",
      type: "select",
      icon: "📹",
      iconName: "cctv",
      section: "amenities",
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ],
    },
  ],
  storage: [
    {
      key: "sizeSqft",
      label: "Size (sqft)",
      type: "number",
      required: true,
      section: "spaceDetails",
    },
    {
      key: "accessHours",
      label: "Access hours",
      type: "select",
      section: "spaceDetails",
      options: [
        { value: "24x7", label: "24/7" },
        { value: "business", label: "Business hours only" },
      ],
    },
    {
      key: "website",
      label: "Website (optional)",
      type: "text",
      section: "spaceDetails",
      placeholder: "https://yourbusiness.com",
    },
  ],
  coworking: [
    {
      // Multi-select, not select — a coworking space can genuinely offer more than one seat
      // type at once (e.g. hot desks and private cabins in the same space). See
      // backfillSeatTypeMultiSelect.ts for the one-off data fix this required, same pattern as
      // PG's sharingType.
      key: "seatType",
      label: "Seat type",
      type: "multi-select",
      section: "workspaceDetails",
      options: [
        { value: "hot-desk", label: "Hot desk" },
        { value: "dedicated-desk", label: "Dedicated desk" },
        { value: "private-cabin", label: "Private cabin" },
      ],
      required: true,
    },
    {
      key: "amenities",
      label: "Amenities",
      type: "text",
      section: "workspaceDetails",
      placeholder: "24/7 access, meeting rooms, high-speed wifi…",
    },
    {
      key: "website",
      label: "Website (optional)",
      type: "text",
      section: "workspaceDetails",
      placeholder: "https://yourspace.com",
    },
    {
      // Same key/options as storage's own accessHours field — one vocabulary for "is this
      // always open" across categories that both actually have the concept.
      key: "accessHours",
      label: "Access hours",
      type: "select",
      section: "workspaceDetails",
      options: [
        { value: "24x7", label: "24/7" },
        { value: "business", label: "Business hours only" },
      ],
    },
    {
      key: "twoWheelerParking",
      label: "Two-wheeler parking",
      type: "select",
      icon: "🛵",
      iconName: "twoWheelerParking",
      section: "amenities",
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ],
    },
    {
      key: "fourWheelerParking",
      label: "Four-wheeler parking",
      type: "select",
      icon: "🚗",
      iconName: "fourWheelerParking",
      section: "amenities",
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ],
    },
    {
      key: "internet",
      label: "Internet / WiFi",
      type: "select",
      icon: "📶",
      iconName: "internet",
      section: "amenities",
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ],
      // Defaults to "Yes" — near-universal for a coworking space, and unlike a guessed
      // price/area (see FieldDef.defaultValue's own doc comment) a wrong default here costs the
      // lister one click to correct rather than misstating a fact about the space itself. Same
      // reasoning RESIDENTIAL_FIELDS.vegetariansOnly already uses for its own default.
      defaultValue: "yes",
    },
    {
      key: "meetingRoomAccess",
      label: "Meeting room access",
      type: "select",
      icon: "🗓️",
      iconName: "meetingRoomAccess",
      section: "amenities",
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ],
    },
    {
      key: "printerAccess",
      label: "Printer / scanner access",
      type: "select",
      icon: "🖨️",
      iconName: "printerAccess",
      section: "amenities",
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ],
    },
    {
      key: "pantry",
      label: "Pantry / cafeteria",
      type: "select",
      icon: "☕",
      iconName: "pantry",
      section: "amenities",
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ],
    },
    {
      key: "powerBackup",
      label: "Power backup",
      type: "select",
      icon: "🔋",
      iconName: "powerBackup",
      section: "amenities",
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ],
    },
  ],
  furniture: [
    {
      key: "material",
      label: "Material",
      type: "select",
      section: "itemDetails",
      options: [
        { value: "wood", label: "Wood" },
        { value: "metal", label: "Metal" },
        { value: "fabric", label: "Fabric" },
        { value: "plastic", label: "Plastic" },
        { value: "other", label: "Other" },
      ],
    },
    {
      key: "dimensions",
      label: "Dimensions",
      type: "text",
      section: "itemDetails",
      placeholder: "e.g. 72in x 36in x 30in",
    },
    {
      key: "condition",
      label: "Condition",
      type: "select",
      section: "itemDetails",
      options: [
        { value: "new", label: "New" },
        { value: "used", label: "Used" },
      ],
      required: true,
    },
    {
      key: "brand",
      label: "Brand (optional)",
      type: "text",
      section: "itemDetails",
    },
    {
      key: "website",
      label: "Website (optional)",
      type: "text",
      section: "itemDetails",
      placeholder: "https://yourstore.com",
    },
  ],
  interiors: [
    {
      key: "serviceType",
      label: "Service type",
      type: "select",
      section: "serviceDetails",
      options: [
        { value: "modular-kitchen", label: "Modular Kitchen" },
        { value: "wardrobe", label: "Wardrobe" },
        { value: "false-ceiling", label: "False Ceiling" },
        { value: "painting", label: "Painting" },
        { value: "full-home", label: "Full Home Interior" },
        { value: "other", label: "Other" },
      ],
      required: true,
    },
    {
      key: "website",
      label: "Website (optional)",
      type: "text",
      section: "serviceDetails",
      placeholder: "https://yourstudio.com",
    },
  ],
  plot: [
    {
      key: "plotAreaSqft",
      label: "Plot Area",
      type: "area",
      units: ["sqft", "acre", "cent", "hectare", "sqm"],
      required: true,
      section: "plotDetails",
    },
    {
      key: "plotDimensions",
      label: "Dimensions",
      type: "text",
      compact: true,
      section: "plotDetails",
      placeholder: "e.g. 30 x 40 ft",
    },
    {
      key: "facing",
      label: "Facing",
      type: "select",
      section: "plotDetails",
      options: [
        { value: "north", label: "North" },
        { value: "south", label: "South" },
        { value: "east", label: "East" },
        { value: "west", label: "West" },
        { value: "north-east", label: "North-East" },
        { value: "north-west", label: "North-West" },
        { value: "south-east", label: "South-East" },
        { value: "south-west", label: "South-West" },
      ],
    },
    {
      key: "boundaryWall",
      label: "Boundary wall",
      type: "select",
      section: "plotDetails",
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ],
    },
    {
      key: "approvedBy",
      label: "Approved by",
      type: "text",
      section: "plotDetails",
      placeholder: "e.g. BDA, Panchayat, DTCP",
    },
    {
      key: "fromBroker",
      label: "Posted by Broker / Agent",
      type: "select",
      section: "pricing",
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ],
    },
    ...BROKERAGE_FIELDS,
  ],
  commercial: [
    {
      key: "sqft",
      label: "Area",
      type: "area",
      units: ["sqft", "acre", "cent", "hectare", "sqm"],
      required: true,
      section: "spaceDetails",
    },
    {
      key: "purpose",
      label: "Purpose",
      type: "select",
      section: "spaceDetails",
      options: [
        { value: "office", label: "Office" },
        { value: "retail", label: "Retail" },
        { value: "warehouse", label: "Warehouse" },
        { value: "showroom", label: "Showroom" },
        { value: "restaurant", label: "Restaurant" },
        { value: "other", label: "Other" },
      ],
      required: true,
    },
    {
      key: "floor",
      label: "Floor",
      type: "text",
      section: "spaceDetails",
      placeholder: "e.g. Ground, 2nd floor",
    },
    {
      key: "furnished",
      label: "Furnishing",
      type: "select",
      section: "spaceDetails",
      options: [
        { value: "unfurnished", label: "Unfurnished" },
        { value: "semi", label: "Semi-furnished" },
        { value: "furnished", label: "Furnished" },
      ],
    },
    {
      key: "website",
      label: "Website (optional)",
      type: "text",
      section: "spaceDetails",
      placeholder: "https://yourbusiness.com",
    },
    {
      key: "fromBroker",
      label: "Posted by Broker / Agent",
      type: "select",
      section: "pricing",
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ],
    },
    ...BROKERAGE_FIELDS,
  ],
};

/**
 * Every amenity key any category declares, and the categories that declare each.
 *
 * Derived rather than listed: amenities are per property type — a flat's amenities are lift, gym,
 * pool, clubhouse; a PG's are an attached bathroom, AC, laundry; a coworking desk's are a meeting
 * room, printer, pantry; a plot has none — and the config is already the place that says so. The
 * filter row, the BFF's accepted values and the posting form therefore cannot disagree about which
 * amenity belongs to which asset.
 */
export const AMENITY_KEYS: string[] = [
  ...new Set(
    Object.values(CATEGORY_FIELD_CONFIG).flatMap((fields) =>
      fields.filter((field) => field.section === "amenities").map((field) => field.key),
    ),
  ),
];

/** The amenity fields of one category, in the order the config declares them — empty for the
 * categories that have none (plot, commercial, furniture, interiors, storage). */
export function amenityFieldsFor(category: ListingCategory): FieldDef[] {
  return (CATEGORY_FIELD_CONFIG[category] ?? []).filter((field) => field.section === "amenities");
}
