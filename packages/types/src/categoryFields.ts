import type { ListingCategory } from "./index";

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldDef {
  key: string;
  label: string;
  type: "text" | "number" | "select";
  options?: FieldOption[];
  placeholder?: string;
  /** Must be filled in before the listing can be posted/saved — enforced in both the
   * posting wizard/edit form (disables submit) and the BFF (`ListingsService`). */
  required?: boolean;
}

const RESIDENTIAL_FIELDS: FieldDef[] = [
  { key: "bedrooms", label: "Bedrooms", type: "number", required: true },
  { key: "bathrooms", label: "Bathrooms", type: "number", required: true },
  { key: "sqft", label: "Area (sqft)", type: "number", required: true },
  {
    key: "furnished",
    label: "Furnishing",
    type: "select",
    options: [
      { value: "unfurnished", label: "Unfurnished" },
      { value: "semi", label: "Semi-furnished" },
      { value: "furnished", label: "Furnished" },
    ],
  },
];

/** One field-def list per category — the single source of truth for both the posting
 * wizard's dynamic step-3 form and the `attributes` JSONB column it maps onto. Adding a
 * future category means adding an entry here, not a new form/code path. */
export const CATEGORY_FIELD_CONFIG: Record<ListingCategory, FieldDef[]> = {
  house: RESIDENTIAL_FIELDS,
  apartment: RESIDENTIAL_FIELDS,
  pg: [
    {
      key: "sharingType",
      label: "Sharing type",
      type: "select",
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
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ],
    },
  ],
  storage: [
    { key: "sizeSqft", label: "Size (sqft)", type: "number", required: true },
    {
      key: "accessHours",
      label: "Access hours",
      type: "select",
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
      options: [
        { value: "hot-desk", label: "Hot desk" },
        { value: "dedicated-desk", label: "Dedicated desk" },
        { value: "private-cabin", label: "Private cabin" },
      ],
      required: true,
    },
    { key: "amenities", label: "Amenities", type: "text", placeholder: "24/7 access, meeting rooms, high-speed wifi…" },
  ],
  furniture: [
    {
      key: "material",
      label: "Material",
      type: "select",
      options: [
        { value: "wood", label: "Wood" },
        { value: "metal", label: "Metal" },
        { value: "fabric", label: "Fabric" },
        { value: "plastic", label: "Plastic" },
        { value: "other", label: "Other" },
      ],
    },
    { key: "dimensions", label: "Dimensions", type: "text", placeholder: "e.g. 72in x 36in x 30in" },
    {
      key: "condition",
      label: "Condition",
      type: "select",
      options: [
        { value: "new", label: "New" },
        { value: "used", label: "Used" },
      ],
      required: true,
    },
    { key: "brand", label: "Brand (optional)", type: "text" },
  ],
  interiors: [
    {
      key: "serviceType",
      label: "Service type",
      type: "select",
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
    { key: "plotAreaSqft", label: "Plot Area (sqft)", type: "number", required: true },
    {
      key: "facing",
      label: "Facing",
      type: "select",
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
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ],
    },
    { key: "approvedBy", label: "Approved by", type: "text", placeholder: "e.g. BDA, Panchayat, DTCP" },
  ],
  commercial: [
    { key: "sqft", label: "Area (sqft)", type: "number", required: true },
    {
      key: "purpose",
      label: "Purpose",
      type: "select",
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
    { key: "floor", label: "Floor", type: "text", placeholder: "e.g. Ground, 2nd floor" },
    {
      key: "furnished",
      label: "Furnishing",
      type: "select",
      options: [
        { value: "unfurnished", label: "Unfurnished" },
        { value: "semi", label: "Semi-furnished" },
        { value: "furnished", label: "Furnished" },
      ],
    },
  ],
};
