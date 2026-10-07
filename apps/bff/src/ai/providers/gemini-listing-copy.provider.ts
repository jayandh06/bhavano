import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { IndianLanguage } from '@bhavano/types/listingCopyAssist';
import { logThirdPartyCall } from '../../logging/thirdPartyCallLogger';
import type { ListingCopyLlmProvider, StructuredListingFields } from './listing-copy-llm.provider';
import { buildDescriptionPrompt, buildSystemPrompt, buildTitlePrompt } from './listing-copy-prompts';

// Pinned, with an escape hatch — same reasoning as WhatsappProvider's DEFAULT_API_VERSION: a
// silently-shifting "latest" model is how a working integration changes behaviour on a date
// nobody wrote down. Override with GEMINI_MODEL if this one is retired. (Confirmed live
// 2026-10-07 against the real Generative Language API: gemini-2.5-flash is no longer available
// to new API keys — Google's own 404 pointed at this one instead.)
const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';

interface GeminiGenerateContentResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

/** Gemini equivalent of OpenAiListingCopyProvider — same shared prompts
 * (listing-copy-prompts.ts), same ListingCopyLlmProvider contract, different wire format. Picked
 * alongside OpenAI (not instead of it) specifically for its stronger Indic-language output —
 * this is the provider `AI_LISTING_COPY_PROVIDER=gemini` or the no-override default (when
 * GEMINI_API_KEY is set) selects. See docs/plans/ai-listing-copy-assist.md. */
@Injectable()
export class GeminiListingCopyProvider implements ListingCopyLlmProvider {
  private readonly logger = new Logger(GeminiListingCopyProvider.name);

  constructor(
    private readonly config: ConfigService,
    @InjectPinoLogger(GeminiListingCopyProvider.name) private readonly callLogger: PinoLogger,
  ) {}

  async generateTitle(input: StructuredListingFields): Promise<string> {
    const { text } = await this.complete<{ text: string }>('generateTitle', buildTitlePrompt(input), ['text'], false);
    return text.trim().slice(0, 150);
  }

  async generateDescription(
    input: StructuredListingFields & { tier: 'free' | 'featured'; landmarks: string[]; secondLanguage?: IndianLanguage },
  ): Promise<{ text: string; secondLanguageText?: string }> {
    const fields = input.secondLanguage ? ['text', 'secondLanguageText'] : ['text'];
    const result = await this.complete<{ text: string; secondLanguageText?: string }>(
      'generateDescription',
      buildDescriptionPrompt(input),
      fields,
      true,
    );
    return { text: result.text.trim(), secondLanguageText: result.secondLanguageText?.trim() };
  }

  private async complete<T>(
    method: string,
    userPrompt: string,
    expectedFields: string[],
    allowFormatting: boolean,
  ): Promise<T> {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException('AI copy generation is not configured on this server yet');
    }
    const model = this.config.get<string>('GEMINI_MODEL') || DEFAULT_GEMINI_MODEL;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const body = {
      systemInstruction: { parts: [{ text: buildSystemPrompt(expectedFields, allowFormatting) }] },
      contents: [{ parts: [{ text: userPrompt }] }],
      // thinkingBudget: 0 — confirmed live 2026-10-07: with thinking on (the default), this
      // model spent ~300 reasoning tokens to answer a ~40-token prompt with a ~40-token result —
      // more thinking than output, for a short fill-structured-fields-into-prose task that was
      // explicitly picked to be cheap and simple (same reasoning as MODEL's own comment in
      // OpenAiListingCopyProvider). Disabling it dropped total tokens ~5x with no quality loss
      // on the same prompt.
      generationConfig: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
    };

    // No maskUrlParam needed — the key goes in a header (X-Goog-Api-Key), same convention
    // GooglePlacesNearbyLandmarksProvider already uses, never in the URL.
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey },
      body: JSON.stringify(body),
    });
    const responseText = await res.text();
    if (!res.ok) {
      this.logger.warn(`Gemini request failed (${method}): ${res.status}`);
      logThirdPartyCall({
        logger: this.callLogger,
        provider: 'gemini',
        method,
        url,
        request: { model },
        status: res.status,
        responseText,
        ok: false,
      });
      throw new ServiceUnavailableException('AI copy generation failed');
    }

    logThirdPartyCall({
      logger: this.callLogger,
      provider: 'gemini',
      method,
      url,
      request: { model },
      status: res.status,
      ok: true,
    });

    const data = JSON.parse(responseText) as GeminiGenerateContentResponse;
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) throw new ServiceUnavailableException('AI copy generation returned an empty response');

    return JSON.parse(content) as T;
  }
}
