import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { INDIAN_LANGUAGE_LABELS, type IndianLanguage } from '@bhavano/types/listingCopyAssist';
import { logThirdPartyCall, maskUrlParam } from '../../logging/thirdPartyCallLogger';
import type { ListingCopyLlmProvider, StructuredListingFields } from './listing-copy-llm.provider';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
// Cheap, fast — this is a short "fill structured fields into fluent prose" task, not deep
// reasoning. See docs/plans/ai-listing-copy-assist.md for the cost comparison that picked this.
const MODEL = 'gpt-5-mini';

function placeText(input: Pick<StructuredListingFields, 'cityName' | 'areaName'>): string {
  if (input.areaName && input.cityName) return `${input.areaName}, ${input.cityName}`;
  return input.cityName ?? input.areaName ?? 'an unspecified location';
}

@Injectable()
export class OpenAiListingCopyProvider implements ListingCopyLlmProvider {
  private readonly logger = new Logger(OpenAiListingCopyProvider.name);

  constructor(
    private readonly config: ConfigService,
    @InjectPinoLogger(OpenAiListingCopyProvider.name) private readonly callLogger: PinoLogger,
  ) {}

  async generateTitle(input: StructuredListingFields): Promise<string> {
    const prompt =
      `Write a short, honest classified-ad title for a real-estate listing in India, as plain text with no quotes or markdown.\n` +
      `Category: ${input.category}\nTransaction: ${input.transactionType}\nLocation: ${placeText(input)}\n` +
      (input.price ? `Price: ₹${input.price}${input.priceQualifier ? ` ${input.priceQualifier}` : ''}\n` : '') +
      (input.attributes ? `Attributes: ${JSON.stringify(input.attributes)}\n` : '') +
      `Keep it to ONE line, at most 100 characters. Do not invent any fact not given above.`;

    const { text } = await this.complete<{ text: string }>('generateTitle', prompt, ['text']);
    return text.trim().slice(0, 150);
  }

  async generateDescription(
    input: StructuredListingFields & { tier: 'free' | 'featured'; landmarks: string[]; secondLanguage?: IndianLanguage },
  ): Promise<{ text: string; secondLanguageText?: string }> {
    const style =
      input.tier === 'featured'
        ? 'Write a richer, more persuasive multi-paragraph description that highlights what makes this place appealing.'
        : 'Write a plain, factual single-paragraph description.';
    const landmarksInstruction =
      input.landmarks.length > 0
        ? `These real nearby places were found near the property: ${input.landmarks.join(', ')}. You may mention some of them naturally. Do NOT name any other place, landmark, mall, school, or station that is not in this exact list.`
        : 'No verified nearby landmarks are available — do not name any specific nearby place, mall, school, or station.';
    const secondLanguageInstruction = input.secondLanguage
      ? `Also provide a "secondLanguageText" field: the same description translated naturally into ${INDIAN_LANGUAGE_LABELS[input.secondLanguage]}.`
      : '';

    const prompt =
      `${style}\n` +
      `This is for a real-estate classified ad in India. Category: ${input.category}\nTransaction: ${input.transactionType}\n` +
      `Location: ${placeText(input)}\n` +
      (input.price ? `Price: ₹${input.price}${input.priceQualifier ? ` ${input.priceQualifier}` : ''}\n` : '') +
      (input.attributes ? `Attributes: ${JSON.stringify(input.attributes)}\n` : '') +
      `${landmarksInstruction}\n${secondLanguageInstruction}\n` +
      `Keep the English description between roughly 100 and 300 words. Never invent a fact not given above.`;

    const fields = input.secondLanguage ? ['text', 'secondLanguageText'] : ['text'];
    const result = await this.complete<{ text: string; secondLanguageText?: string }>('generateDescription', prompt, fields);
    return { text: result.text.trim(), secondLanguageText: result.secondLanguageText?.trim() };
  }

  private async complete<T>(method: string, userPrompt: string, expectedFields: string[]): Promise<T> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException('AI copy generation is not configured on this server yet');
    }

    const systemPrompt =
      `You write concise, honest real-estate classified-ad copy for the Indian market. ` +
      `Reply with ONLY a JSON object with exactly these keys: ${expectedFields.join(', ')}. No other text.`;

    const body = {
      model: MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    };

    const maskedUrl = maskUrlParam(OPENAI_URL, 'key');
    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });
    const responseText = await res.text();
    if (!res.ok) {
      this.logger.warn(`OpenAI request failed (${method}): ${res.status}`);
      logThirdPartyCall({
        logger: this.callLogger,
        provider: 'openai',
        method,
        url: maskedUrl,
        request: { model: MODEL },
        status: res.status,
        responseText,
        ok: false,
      });
      throw new ServiceUnavailableException('AI copy generation failed');
    }

    logThirdPartyCall({
      logger: this.callLogger,
      provider: 'openai',
      method,
      url: maskedUrl,
      request: { model: MODEL },
      status: res.status,
      ok: true,
    });

    const data = JSON.parse(responseText) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new ServiceUnavailableException('AI copy generation returned an empty response');

    return JSON.parse(content) as T;
  }
}
