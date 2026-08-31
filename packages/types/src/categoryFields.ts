import type { ListingCategory, TransactionType } from "./index";

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
  "pricing",
  "basics",
  "roomDetails",
  "spaceDetails",
  "workspaceDetails",
  "itemDetails",
  "serviceDetails",
  "plotDetails",
  "preferences",
  "furnishing",
  "amenities",
];

export interface FieldDef {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "multi-select";
  options?: FieldOption[];
  placeholder?: string;
  min?: number;
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
  attributes: Record<string, string | string[]>,
): boolean {
  return (
    (!field.transactionTypes ||
      field.transactionTypes.includes(transactionType)) &&
    (!field.dependsOn ||
      attributes[field.dependsOn.key] === field.dependsOn.value)
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
        removedAny = true;
      }
    }
  }
  return next;
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
    label: "Posted by broker",
    type: "select",
    section: "pricing",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
  },
  {
    // Shared gate for both brokerage-amount fields below — no transactionTypes restriction of
    // its own, since a sale can involve a broker just as much as a rental can.
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
    key: "brokerageFee",
    label: "Brokerage fee (₹)",
    type: "number",
    maxDigits: 5,
    min: 0,
    section: "pricing",
    transactionTypes: ["rent", "lease"],
    dependsOn: { key: "brokerageFeeApplicable", value: "yes" },
  },
  {
    // Sale-side brokerage is conventionally quoted as a % of sale price rather than a flat
    // amount — a distinct field/key rather than reusing `brokerageFee` for both, so neither the
    // BFF nor the listing detail page has to guess whether a stored number means ₹ or %.
    key: "brokerageCommissionPercent",
    label: "Brokerage commission (%)",
    type: "number",
    min: 0,
    maxDigits: 2,
    section: "pricing",
    transactionTypes: ["sell"],
    dependsOn: { key: "brokerageFeeApplicable", value: "yes" },
  },
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
      key: "sharingType",
      label: "Sharing type",
      type: "select",
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
      key: "gender",
      label: "Preferred for",
      type: "select",
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
  ],
  coworking: [
    {
      key: "seatType",
      label: "Seat type",
      type: "select",
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
  ],
  plot: [
    {
      key: "plotAreaSqft",
      label: "Plot Area (sqft)",
      type: "number",
      required: true,
      section: "plotDetails",
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
  ],
  commercial: [
    {
      key: "sqft",
      label: "Area (sqft)",
      type: "number",
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
  ],
};
