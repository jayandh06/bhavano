import { INDIAN_LANGUAGE_LABELS, type IndianLanguage } from '@bhavano/types/listingCopyAssist';
import type { StructuredListingFields } from './listing-copy-llm.provider';

/**
 * Prompt text shared by every real `ListingCopyLlmProvider` implementation (OpenAI, Gemini, ...)
 * — the wording a provider sends is what actually determines generation quality/consistency, so
 * this lives in one place rather than being copy-pasted per provider and drifting between them.
 * Each provider only differs in how it calls its API and parses the response.
 */

function placeText(input: Pick<StructuredListingFields, 'cityName' | 'areaName'>): string {
  if (input.areaName && input.cityName) return `${input.areaName}, ${input.cityName}`;
  return input.cityName ?? input.areaName ?? 'an unspecified location';
}

/** `allowFormatting` is false for the title call: a title is one line shown in a listing card's
 * header, where a bullet or a blank line would just break the layout — buildTitlePrompt already
 * separately says "plain text, no markdown" for the same reason, so this isn't the only guard,
 * but the system prompt shouldn't contradict it by blanket-allowing marks it then has to recall
 * per-call. */
export function buildSystemPrompt(expectedFields: string[], allowFormatting: boolean): string {
  const formattingClause = allowFormatting
    ? `Inside a "text"-type value, you may use exactly three formatting marks, and no others: a ` +
      `blank line between paragraphs, "**word or phrase**" to bold it, and a line starting with ` +
      `"- " for one item of a bullet list. Never use markdown headings, numbered lists, tables, or ` +
      `any other syntax — these three are the only marks a renderer on the other end understands.`
    : `Plain text only — no markdown, no bullets, no blank lines.`;
  return (
    `You write concise, honest real-estate classified-ad copy for the Indian market. ` +
    `Reply with ONLY a JSON object with exactly these keys: ${expectedFields.join(', ')}. No other text. ` +
    formattingClause
  );
}

export function buildTitlePrompt(input: StructuredListingFields): string {
  return (
    `Write a short, honest classified-ad title for a real-estate listing in India, as plain text with no quotes or markdown.\n` +
    `Category: ${input.category}\nTransaction: ${input.transactionType}\nLocation: ${placeText(input)}\n` +
    (input.price ? `Price: ₹${input.price}${input.priceQualifier ? ` ${input.priceQualifier}` : ''}\n` : '') +
    (input.attributes ? `Attributes: ${JSON.stringify(input.attributes)}\n` : '') +
    `Keep it to ONE line, at most 100 characters. Do not invent any fact not given above.`
  );
}

export function buildDescriptionPrompt(
  input: StructuredListingFields & { tier: 'free' | 'featured'; landmarks: string[]; secondLanguage?: IndianLanguage },
): string {
  const style =
    input.tier === 'featured'
      ? 'Write a richer, more persuasive description: an opening paragraph, then a bullet list of ' +
        '3-5 standout highlights (amenities, condition, standout facts), then a closing paragraph. ' +
        'Bold the 1-3 most compelling phrases.'
      : 'Write a plain, factual description in 1-2 short paragraphs. You may bold at most one or ' +
        'two genuinely standout facts — don\'t overuse it. No bullet list at this tier.';
  const landmarksInstruction =
    input.landmarks.length > 0
      ? `These real nearby places were found near the property: ${input.landmarks.join(', ')}. You may mention some of them naturally. Do NOT name any other place, landmark, mall, school, or station that is not in this exact list.`
      : 'No verified nearby landmarks are available — do not name any specific nearby place, mall, school, or station.';
  const secondLanguageInstruction = input.secondLanguage
    ? `Also provide a "secondLanguageText" field: the same description translated naturally into ${INDIAN_LANGUAGE_LABELS[input.secondLanguage]}.`
    : '';

  return (
    `${style}\n` +
    `This is for a real-estate classified ad in India. Category: ${input.category}\nTransaction: ${input.transactionType}\n` +
    `Location: ${placeText(input)}\n` +
    (input.price ? `Price: ₹${input.price}${input.priceQualifier ? ` ${input.priceQualifier}` : ''}\n` : '') +
    (input.attributes ? `Attributes: ${JSON.stringify(input.attributes)}\n` : '') +
    `${landmarksInstruction}\n${secondLanguageInstruction}\n` +
    `Keep the English description between roughly 100 and 300 words. Never invent a fact not given above.`
  );
}
