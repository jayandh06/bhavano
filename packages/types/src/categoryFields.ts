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
}

const RESIDENTIAL_FIELDS: FieldDef[] = [
  { key: "bedrooms", label: "Bedrooms", type: "number" },
  { key: "bathrooms", label: "Bathrooms", type: "number" },
  { key: "sqft", label: "Area (sqft)", type: "number" },
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
    { key: "sizeSqft", label: "Size (sqft)", type: "number" },
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
    },
    { key: "brand", label: "Brand (optional)", type: "text" },
  ],
};
