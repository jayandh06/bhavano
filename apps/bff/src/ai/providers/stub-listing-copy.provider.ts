import { Injectable } from '@nestjs/common';
import type { IndianLanguage } from '@bhavano/types/listingCopyAssist';
import type { ListingCopyLlmProvider, StructuredListingFields } from './listing-copy-llm.provider';

const TRANSACTION_PHRASE: Record<string, string> = {
  buy: 'for sale',
  sell: 'for sale',
  rent: 'for rent',
  lease: 'for lease',
};

/** Deterministic, no-network stand-in used whenever OPENAI_API_KEY is unset or NODE_ENV is
 * 'test' — see the factory provider in ai.module.ts. Text is long enough to clear
 * DESCRIPTION_MIN_LENGTH and short enough to stay under TITLE_MAX_LENGTH, so downstream
 * moderation/length checks stay exercisable in dev/CI without a real LLM call. Doesn't reuse
 * apps/web's CATEGORY_LABELS/TRANSACTION_LABELS — those are web-app-local, not in the shared
 * `@bhavano/types` package — plain category/transactionType strings are fine here since this
 * text is never shown as a final UI label, only edited by the user or compared against in tests. */
@Injectable()
export class StubListingCopyProvider implements ListingCopyLlmProvider {
  async generateTitle(input: StructuredListingFields): Promise<string> {
    const place = input.areaName ? `${input.areaName}, ${input.cityName}` : input.cityName;
    const phrase = TRANSACTION_PHRASE[input.transactionType] ?? '';
    return `${capitalize(input.category)} ${phrase} in ${place ?? 'your city'}`.slice(0, 100);
  }

  async generateDescription(
    input: StructuredListingFields & {
      tier: 'free' | 'featured';
      landmarks: string[];
      secondLanguage?: IndianLanguage;
    },
  ): Promise<{ text: string; secondLanguageText?: string }> {
    const place = input.areaName ? `${input.areaName}, ${input.cityName}` : input.cityName ?? 'a great location';
    const phrase = TRANSACTION_PHRASE[input.transactionType] ?? '';
    const base = `A well-kept ${input.category} ${phrase} in ${place}. This listing offers good connectivity and a comfortable living space suited to everyday needs.`;
    const landmarksSentence =
      input.tier === 'featured' && input.landmarks.length > 0
        ? ` Close to ${input.landmarks.slice(0, 3).join(', ')}.`
        : '';
    const text = `${base}${landmarksSentence} [stub-generated]`;
    return {
      text,
      secondLanguageText: input.secondLanguage ? `${text} (stub ${input.secondLanguage} translation)` : undefined,
    };
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
