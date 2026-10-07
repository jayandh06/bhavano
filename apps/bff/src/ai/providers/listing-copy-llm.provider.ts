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

export type ListingCopyProviderChoice = 'stub' | 'openai' | 'gemini';

/**
 * Picks which `ListingCopyLlmProvider` the factory in ai.module.ts hands out. A pure function,
 * not inlined there, specifically so this decision is unit-testable without booting the module.
 *
 * `providerOverride` (`AI_LISTING_COPY_PROVIDER`) is the explicit choice when both keys are
 * configured and it genuinely matters which one runs. Left unset, Gemini wins by default when
 * both are available — picked for its stronger output on the Indic `secondLanguage` descriptions
 * this feature offers, not because OpenAI is deprecated; either stays fully supported. An
 * override naming a provider whose key isn't actually set falls back to the stub rather than
 * throwing — same "assist, not core functionality" stance as every other branch here. See
 * docs/plans/ai-listing-copy-assist.md.
 */
export function resolveListingCopyProvider(input: {
  providerOverride?: string;
  openaiConfigured: boolean;
  geminiConfigured: boolean;
  isTestEnv: boolean;
}): ListingCopyProviderChoice {
  if (input.isTestEnv) return 'stub';

  if (input.providerOverride === 'openai') return input.openaiConfigured ? 'openai' : 'stub';
  if (input.providerOverride === 'gemini') return input.geminiConfigured ? 'gemini' : 'stub';

  if (input.geminiConfigured) return 'gemini';
  if (input.openaiConfigured) return 'openai';
  return 'stub';
}
