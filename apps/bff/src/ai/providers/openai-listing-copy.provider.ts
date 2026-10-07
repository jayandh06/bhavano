import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { IndianLanguage } from '@bhavano/types/listingCopyAssist';
import { logThirdPartyCall, maskUrlParam } from '../../logging/thirdPartyCallLogger';
import type { ListingCopyLlmProvider, StructuredListingFields } from './listing-copy-llm.provider';
import { buildDescriptionPrompt, buildSystemPrompt, buildTitlePrompt } from './listing-copy-prompts';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
// Cheap, fast — this is a short "fill structured fields into fluent prose" task, not deep
// reasoning. See docs/plans/ai-listing-copy-assist.md for the cost comparison that picked this.
const MODEL = 'gpt-5-mini';

@Injectable()
export class OpenAiListingCopyProvider implements ListingCopyLlmProvider {
  private readonly logger = new Logger(OpenAiListingCopyProvider.name);

  constructor(
    private readonly config: ConfigService,
    @InjectPinoLogger(OpenAiListingCopyProvider.name) private readonly callLogger: PinoLogger,
  ) {}

  async generateTitle(input: StructuredListingFields): Promise<string> {
    const { text } = await this.complete<{ text: string }>('generateTitle', buildTitlePrompt(input), ['text']);
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
    );
    return { text: result.text.trim(), secondLanguageText: result.secondLanguageText?.trim() };
  }

  private async complete<T>(method: string, userPrompt: string, expectedFields: string[]): Promise<T> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException('AI copy generation is not configured on this server yet');
    }

    const systemPrompt = buildSystemPrompt(expectedFields);

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
