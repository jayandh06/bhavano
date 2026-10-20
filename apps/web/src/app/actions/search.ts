"use server";

import type { SearchInterpretationDto } from "@bhavano/types/searchInterpretation";
import { interpretSearch } from "@/lib/bff";

/** Called by the search bar only for sentences its own rule-based reader is likely to misread
 * (docs/plans/ai-sentence-search.md). Always resolves; null means "carry on without AI". */
export async function interpretSearchAction(text: string, cityName?: string): Promise<SearchInterpretationDto | null> {
  return interpretSearch(text.slice(0, 200), cityName);
}
