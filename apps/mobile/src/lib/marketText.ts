import type { MarketId } from "@bhavano/types/market";
import { bedWord, bedroomLabel } from "@bhavano/types/bedrooms";
import { INTENT_CATEGORIES, budgetPresetsFor, formatCompactMoney, intentCategories, requirementIntentsFor } from "@bhavano/types/requirementQuestions";
import type { ListingCategory, TransactionType } from "@bhavano/types";

/** The app's own wording that differs by market. India's results are exactly what the screens printed before. */

export { bedWord, requirementIntentsFor };

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

/** A short amount for chips and one-line summaries: "₹1.5L" in India, "$1.5M" or "$25k" in the US. */
export const compactMoney = formatCompactMoney;

/** The amount on a saved search's summary line (India writes a capital K there). */
export function savedSearchMoney(amount: number, id: MarketId): string {
  if (id === "us") return compactMoney(amount, id);
  if (amount >= 10_000_000) return `₹${+(amount / 10_000_000).toFixed(2)}Cr`;
  if (amount >= 100_000) return `₹${+(amount / 100_000).toFixed(2)}L`;
  if (amount >= 1_000) return `₹${+(amount / 1_000).toFixed(1)}K`;
  return `₹${amount}`;
}

export function requirementCategoriesFor(intent: keyof typeof INTENT_CATEGORIES, id: MarketId): ListingCategory[] {
  return intentCategories(intent, id);
}

/** Budget bands to tap; none in the US, where the seeker types the numbers. */
export const budgetChoices = budgetPresetsFor;
