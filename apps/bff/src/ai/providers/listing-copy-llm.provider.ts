import type { ListingCategory, TransactionType } from '@bhavano/types';
import type { IndianLanguage } from '@bhavano/types/listingCopyAssist';

export interface StructuredListingFields {
  category: ListingCategory;
  transactionType: TransactionType;
  price?: number;
  priceQualifier?: string;
  cityName?: string;
  areaName?: string;
  attributes?: Record<string, unknown>;
}

export const LISTING_COPY_LLM_PROVIDER = 'LISTING_COPY_LLM_PROVIDER';

/** Swappable (real OpenAI call vs. a deterministic stub for dev/test) — see
 * docs/plans/ai-listing-copy-assist.md. Implementations must never invent a landmark name of
 * their own; `generateDescription`'s `landmarks` param is a closed list of real, Places-returned
 * names the prompt is instructed to narrate from and nothing else. */
export interface ListingCopyLlmProvider {
  generateTitle(input: StructuredListingFields): Promise<string>;
  generateDescription(
    input: StructuredListingFields & {
      tier: 'free' | 'featured';
      landmarks: string[];
      secondLanguage?: IndianLanguage;
    },
  ): Promise<{ text: string; secondLanguageText?: string }>;
}
