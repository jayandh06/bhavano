import { formatMoney, type MarketId } from "@bhavano/types/market";
import { bedroomLabel } from "@bhavano/types/bedrooms";
import { INTENT_CATEGORIES, REQUIREMENT_INTENTS, budgetPresetsFor, formatCompactInr, intentCategories } from "@bhavano/types/requirementQuestions";
import type { ListingCategory, TransactionType } from "@bhavano/types";

/** The app's own wording that differs by market. India's results are exactly what the screens printed before. */

/** "BHK" in India, "bed" in the US. */
export function bedWord(id: MarketId): string {
  return id === "us" ? "bed" : "BHK";
}

/** "2 BHK", "5+ bed". */
export function bedroomText(n: number, id: MarketId): string {
  return `${bedroomLabel(n)} ${bedWord(id)}`;
}

/** Several counts sharing one word: "2, 3 BHK", "2 or 3 bed". */
export function bedroomListText(counts: number[], separator: string, id: MarketId): string {
  return `${counts.map(bedroomLabel).join(separator)} ${bedWord(id)}`;
}

/** "Favourite" is "Favorite" in the US. */
export function spell(text: string, id: MarketId): string {
  return id === "us" ? text.replace(/avourite/g, "avorite") : text;
}

/** Cut to two decimals, never rounded up, as the Indian short forms are. */
function trimmed(value: number): string {
  return String(Math.floor(value * 100 + 1e-9) / 100);
}

/** A short amount for chips and one-line summaries: "₹1.5L" in India, "$1.5M" or "$25k" in the US. */
export function compactMoney(amount: number, id: MarketId): string {
  if (id !== "us") return formatCompactInr(amount);
  if (amount >= 1_000_000) return `$${trimmed(amount / 1_000_000)}M`;
  if (amount >= 1_000) return `$${trimmed(amount / 1_000)}k`;
  return formatMoney(id, amount);
}

/** The amount on a saved search's summary line (India writes a capital K there). */
export function savedSearchMoney(amount: number, id: MarketId): string {
  if (id === "us") return compactMoney(amount, id);
  if (amount >= 10_000_000) return `₹${+(amount / 10_000_000).toFixed(2)}Cr`;
  if (amount >= 100_000) return `₹${+(amount / 100_000).toFixed(2)}L`;
  if (amount >= 1_000) return `₹${+(amount / 1_000).toFixed(1)}K`;
  return `₹${amount}`;
}

/** "Looking to ..." choices that have at least one category in the market (the US has no PG, coworking, furniture or interiors). */
export function requirementIntentsFor(id: MarketId): typeof REQUIREMENT_INTENTS {
  if (id === "in") return REQUIREMENT_INTENTS;
  return REQUIREMENT_INTENTS.filter((intent) => intentCategories(intent.value, id).length > 0);
}

export function requirementCategoriesFor(intent: keyof typeof INTENT_CATEGORIES, id: MarketId): ListingCategory[] {
  return intentCategories(intent, id);
}

/** Budget bands to tap. The shared bands are rupee amounts, so the US offers none: the seeker types the numbers. */
export function budgetChoices(category: ListingCategory | undefined, transaction: TransactionType | undefined, id: MarketId) {
  const shared = budgetPresetsFor(category, transaction);
  return id === "us" ? { unit: shared.unit, presets: [] as typeof shared.presets } : shared;
}
