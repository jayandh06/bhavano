import type { ListingCategory, TransactionType } from "@bhavano/types";
import { CATEGORY_FIELD_CONFIG, fieldIsVisible, type FieldDef } from "@bhavano/types/categoryFields";
import { DESCRIPTION_MAX_LENGTH, DESCRIPTION_MIN_LENGTH, TITLE_MAX_LENGTH, TITLE_MIN_LENGTH } from "@bhavano/types/listingLimits";
import { POST_CATEGORIES } from "@bhavano/types/postCategories";
import { PRICE_BOUNDS } from "@bhavano/types/priceBounds";
import { getPriceQualifierOptions } from "@bhavano/types/priceQualifiers";
import { POSTABLE_TRANSACTION_TYPES } from "@bhavano/types/postingRules";

/** Ready-made ads for admins to test the post-ad flow without typing: pick one on /post and it fills the form and opens the preview.
 * See docs/plans/post-ad-test-scenarios.md. Pure functions, so a test can check that every scenario passes the form's own validation. */
export type ScenarioVariant = "standard" | "minimal" | "long_text" | "high_price" | "low_price";

export interface PostAdScenario {
  id: string;
  label: string;
  category: ListingCategory;
  transactionType: TransactionType;
  variant: ScenarioVariant;
}

export const TRANSACTION_WORDS: Record<TransactionType, string> = { buy: "Buy", sell: "Sale", rent: "Rent", lease: "Lease" };

const VARIANT_LABELS: Record<ScenarioVariant, string> = {
  standard: "",
  minimal: " (only required fields)",
  long_text: " (longest title and description)",
  high_price: " (highest allowed price)",
  low_price: " (lowest allowed price)",
};

function categoryLabel(category: ListingCategory): string {
  return POST_CATEGORIES.find((c) => c.value === category)?.label ?? category;
}

/** Every postable category and transaction type once as a standard ad, then the edge cases on a few common ones. */
export function postAdScenarios(): PostAdScenario[] {
  const make = (category: ListingCategory, transactionType: TransactionType, variant: ScenarioVariant): PostAdScenario => ({
    id: `${category}-${transactionType}-${variant}`,
    label: `${categoryLabel(category)} for ${TRANSACTION_WORDS[transactionType]}${VARIANT_LABELS[variant]}`,
    category,
    transactionType,
    variant,
  });
  const standard = (Object.keys(POSTABLE_TRANSACTION_TYPES) as ListingCategory[]).flatMap((category) =>
    POSTABLE_TRANSACTION_TYPES[category].map((transactionType) => make(category, transactionType, "standard")),
  );
  const edges: PostAdScenario[] = [
    make("apartment", "rent", "minimal"),
    make("apartment", "sell", "minimal"),
    make("apartment", "rent", "long_text"),
    make("apartment", "sell", "high_price"),
    make("apartment", "rent", "low_price"),
    make("plot", "sell", "minimal"),
    make("plot", "sell", "high_price"),
    make("pg", "rent", "minimal"),
  ];
  return [...standard, ...edges];
}

export function scenarioById(id: string): PostAdScenario | undefined {
  return postAdScenarios().find((s) => s.id === id);
}

/** One valid value for a field, or undefined when it should be left empty (a link or a free-text note that is no use in a test). */
function sampleValue(field: FieldDef, price: number): string | string[] | undefined {
  switch (field.type) {
    case "select":
      return field.options?.[0]?.value;
    case "multi-select": {
      const first = field.options?.[0]?.value;
      return first ? [first] : undefined;
    }
    case "area":
      return "1200";
    case "number": {
      // A fee scaled to the price, so the lowest-price case does not trip the brokerage-against-rent limit.
      if (field.rupees) return String(Math.max(field.min ?? 0, Math.min(5000, Math.floor(price / 4))));
      const wanted = Math.max(field.min ?? 0, 2);
      return String(field.max !== undefined ? Math.min(wanted, field.max) : wanted);
    }
    case "text":
      return /web|url|link|http/i.test(field.key) ? undefined : field.compact ? "30 x 40 ft" : "Test value";
  }
}

/** Fills every visible field (the `minimal` variant only the required ones). Repeats until nothing new appears, because answering one
 * field can reveal another that depends on it. */
export function scenarioAttributes(
  category: ListingCategory,
  transactionType: TransactionType,
  variant: ScenarioVariant = "standard",
  price: number = scenarioPrice(category, transactionType, variant),
): Record<string, string | string[]> {
  const attributes: Record<string, string | string[]> = {};
  for (const field of CATEGORY_FIELD_CONFIG[category]) {
    if (field.defaultValue !== undefined) attributes[field.key] = field.defaultValue;
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const field of CATEGORY_FIELD_CONFIG[category]) {
      if (!fieldIsVisible(field, transactionType, attributes)) continue;
      if (variant === "minimal" && !field.required) continue;
      const current = attributes[field.key];
      if (current !== undefined && current !== "") continue;
      const value = sampleValue(field, price);
      if (value === undefined) continue;
      attributes[field.key] = value;
      if (field.type === "area") attributes[`${field.key}Unit`] = "sqft";
      changed = true;
    }
  }
  return attributes;
}

/** A believable price inside the allowed range (the lowest or highest allowed one for the edge variants), rounded to two significant digits. */
export function scenarioPrice(category: ListingCategory, transactionType: TransactionType, variant: ScenarioVariant = "standard"): number {
  const bounds = PRICE_BOUNDS[category][transactionType === "buy" || transactionType === "sell" ? "sale" : "rental"];
  if (variant === "high_price") return bounds.max;
  if (variant === "low_price") return bounds.min;
  const typical = Math.sqrt(bounds.min * bounds.max) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(typical));
  const rounded = Math.round(typical / magnitude) * magnitude;
  return Math.min(bounds.max, Math.max(bounds.min, rounded));
}

export function scenarioQualifier(category: ListingCategory, transactionType: TransactionType): string {
  return getPriceQualifierOptions(category, transactionType)[0]?.value ?? "";
}

/** Title and description; the `[TEST]` prefix makes the real listing easy to find and remove afterwards. */
export function scenarioCopy(scenario: PostAdScenario, areaName: string): { title: string; description: string } {
  const where = areaName.trim() || "your area";
  const base = `[TEST] ${categoryLabel(scenario.category)} for ${TRANSACTION_WORDS[scenario.transactionType]} in ${where}`;
  const sentence = "This is a test ad created from the admin test scenarios and can be deleted. ";
  if (scenario.variant === "long_text") {
    const title = `${base} - ${"long title ".repeat(30)}`.slice(0, TITLE_MAX_LENGTH).trimEnd();
    return { title, description: sentence.repeat(Math.ceil(DESCRIPTION_MAX_LENGTH / sentence.length)).slice(0, DESCRIPTION_MAX_LENGTH).trimEnd() };
  }
  const title = base.length >= TITLE_MIN_LENGTH ? base : `${base} ${"x".repeat(TITLE_MIN_LENGTH)}`;
  const description = scenario.variant === "minimal" ? sentence.repeat(2).slice(0, Math.max(DESCRIPTION_MIN_LENGTH, 60)).trimEnd() : sentence.repeat(3).trimEnd();
  return { title, description };
}

/** Three small, different JPEGs drawn in the browser, so a test ad needs no files on disk (and the duplicate-photo check sees distinct images). */
export async function scenarioPhotos(count = 3): Promise<File[]> {
  const hues = [210, 30, 140, 280, 350];
  const files: File[] = [];
  for (let i = 0; i < count; i += 1) {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 800;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not available in this browser");
    const hue = hues[i % hues.length];
    const gradient = ctx.createLinearGradient(0, 0, 1200, 800);
    gradient.addColorStop(0, `hsl(${hue}, 60%, 70%)`);
    gradient.addColorStop(1, `hsl(${(hue + 40) % 360}, 60%, 40%)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1200, 800);
    // Different shapes per photo, so no two are near-duplicates.
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(100 + i * 160, 150 + i * 90, 400 + i * 40, 300);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 72px sans-serif";
    ctx.fillText(`TEST PHOTO ${i + 1}`, 120, 700);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob) throw new Error("Could not draw a test photo");
    files.push(new File([blob], `test-photo-${i + 1}.jpg`, { type: "image/jpeg", lastModified: Date.now() + i }));
  }
  return files;
}
