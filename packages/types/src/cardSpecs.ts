import type { ListingCategory } from "./index";
import { CATEGORY_FIELD_CONFIG } from "./categoryFields";

/**
 * The two or three facts a listing card shows under its title.
 *
 * Derived from the attributes the seller already filled in, rather than asked for a second time.
 * The posting form used to have a free-text "Specs" box alongside the category fields, so people
 * typed the same numbers twice and typed them differently each time — production had "3bhk",
 * "3 BHK" and "3 Beds" as three spellings of one bedroom count, and a bare "1500" that did not
 * say what it measured.
 *
 * Only the card needs this. The detail page renders every attribute in labelled sections, so
 * chips there said the same thing twice a few hundred pixels apart.
 *
 * Two or three entries, never more: the card renders them in a single row that does not wrap.
 */

type Chip =
  /** A count with a unit — "3 Beds". Omitted at zero, which is a real answer meaning "none"
   *  rather than a missing one, and not worth a chip either way. */
  | { kind: "count"; key: string; one: string; many: string }
  /** A number with a fixed suffix — "1450 sqft". */
  | { kind: "unit"; key: string; suffix: string }
  /** A select rendered as its own option label — "Double sharing", "Hot desk". */
  | { kind: "option"; key: string }
  /** A select shown only for certain values, under a label of our own — so `meals: "yes"`
   *  reads "Meals included" rather than "Yes", and `meals: "no"` shows nothing. */
  | { kind: "flag"; key: string; when: string[]; label: string }
  /** A select rendered as its label plus a suffix — "East facing". */
  | { kind: "optionSuffix"; key: string; suffix: string };

const PROPERTY: Chip[] = [
  { kind: "count", key: "bedrooms", one: "Bed", many: "Beds" },
  { kind: "count", key: "bathrooms", one: "Bath", many: "Baths" },
  { kind: "unit", key: "carpetAreaSqft", suffix: "sqft" },
];

const RECIPES: Record<ListingCategory, Chip[]> = {
  house: PROPERTY,
  apartment: PROPERTY,
  villa: PROPERTY,
  pg: [
    { kind: "option", key: "sharingType" },
    { kind: "option", key: "gender" },
    { kind: "flag", key: "meals", when: ["yes"], label: "Meals included" },
  ],
  storage: [
    { kind: "unit", key: "sizeSqft", suffix: "sqft" },
    { kind: "option", key: "accessHours" },
  ],
  coworking: [{ kind: "option", key: "seatType" }],
  furniture: [
    { kind: "option", key: "material" },
    { kind: "option", key: "condition" },
  ],
  interiors: [{ kind: "option", key: "serviceType" }],
  plot: [
    { kind: "unit", key: "plotAreaSqft", suffix: "sqft" },
    { kind: "optionSuffix", key: "facing", suffix: "facing" },
  ],
  commercial: [
    { kind: "unit", key: "sqft", suffix: "sqft" },
    { kind: "option", key: "purpose" },
    { kind: "option", key: "furnished" },
  ],
};

/** Attributes arrive as JSON, so a number may be a number or the string a form submitted. */
function toNumber(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

/** A select's human label, from the same config the form rendered it with — so the chip and the
 * detail page cannot disagree about what "double" is called. */
function optionLabel(category: ListingCategory, key: string, value: unknown): string | undefined {
  if (typeof value !== "string" || value === "") return undefined;
  const field = CATEGORY_FIELD_CONFIG[category]?.find((f) => f.key === key);
  return field?.options?.find((o) => o.value === value)?.label;
}

/**
 * Card chips for a listing, in recipe order, skipping anything the seller left blank.
 *
 * Returns an empty array when nothing is derivable — a category with no recipe, or a listing
 * posted before its attributes were collected. Callers fall back to the stored `specs` column,
 * which is what the ~17 listings that predate this still render.
 */
export function deriveCardSpecs(
  category: ListingCategory,
  attributes: Record<string, unknown> | null | undefined,
): string[] {
  if (!attributes) return [];
  const chips: string[] = [];

  for (const chip of RECIPES[category] ?? []) {
    const raw = attributes[chip.key];
    if (raw === undefined || raw === null || raw === "") continue;

    if (chip.kind === "count") {
      const n = toNumber(raw);
      if (n === undefined || n <= 0) continue;
      chips.push(`${n} ${n === 1 ? chip.one : chip.many}`);
    } else if (chip.kind === "unit") {
      const n = toNumber(raw);
      if (n === undefined || n <= 0) continue;
      chips.push(`${n.toLocaleString("en-IN")} ${chip.suffix}`);
    } else if (chip.kind === "flag") {
      if (typeof raw === "string" && chip.when.includes(raw)) chips.push(chip.label);
    } else {
      const label = optionLabel(category, chip.key, raw);
      if (!label) continue;
      chips.push(chip.kind === "optionSuffix" ? `${label} ${chip.suffix}` : label);
    }
  }

  return chips;
}
