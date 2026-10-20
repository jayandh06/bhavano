import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { logThirdPartyCall } from '../logging/thirdPartyCallLogger';
import { resolveListingCopyProvider } from '../ai/providers/listing-copy-llm.provider';
import { buildSearchSystemPrompt, buildSearchUserPrompt } from './search-interpret.prompt';

const TIMEOUT_MS = 4000;
// Same pinned, smallest-tier choices the listing-copy providers use (see their comments): this is a
// short "fill a fixed JSON shape" task, not deep reasoning.
const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';
const OPENAI_MODEL = 'gpt-5-mini';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

/** One short model call that returns the raw JSON the model produced (unvalidated), or null when no
 * provider is configured or the call failed/timed out. Never throws: AI search is an extra, and
 * search must work without it. The key choice follows the listing-copy assist's own rule
 * (AI_LISTING_COPY_PROVIDER override, else Gemini, else OpenAI). */
@Injectable()
export class SearchInterpretLlm {
  private readonly logger = new Logger(SearchInterpretLlm.name);

  constructor(
    private readonly config: ConfigService,
    @InjectPinoLogger(SearchInterpretLlm.name) private readonly callLogger: PinoLogger,
  ) {}

  isConfigured(): boolean {
    return this.provider() !== 'stub';
  }

  private provider() {
    return resolveListingCopyProvider({
      providerOverride: this.config.get<string>('AI_LISTING_COPY_PROVIDER'),
      openaiConfigured: Boolean(this.config.get<string>('OPENAI_API_KEY')),
      geminiConfigured: Boolean(this.config.get<string>('GEMINI_API_KEY')),
      isTestEnv: process.env.NODE_ENV === 'test',
    });
  }

  async interpret(text: string, sharingTypes: readonly string[], browsingCity?: string): Promise<unknown | null> {
    const provider = this.provider();
    if (provider === 'stub') return null;
    const system = buildSearchSystemPrompt(sharingTypes);
    const user = buildSearchUserPrompt(text, browsingCity);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const content = provider === 'gemini' ? await this.callGemini(system, user, controller.signal) : await this.callOpenAi(system, user, controller.signal);
      return content ? JSON.parse(content) : null;
    } catch (error) {
      this.logger.warn(`AI search interpretation failed: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private async callGemini(system: string, user: string, signal: AbortSignal): Promise<string | null> {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) return null;
    const model = this.config.get<string>('GEMINI_MODEL') || DEFAULT_GEMINI_MODEL;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const res = await fetch(url, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ parts: [{ text: user }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    });
    const responseText = await res.text();
    logThirdPartyCall({ logger: this.callLogger, provider: 'gemini', method: 'interpretSearch', url, request: { model }, status: res.status, responseText: res.ok ? undefined : responseText, ok: res.ok });
    if (!res.ok) return null;
    const data = JSON.parse(responseText) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
  }

  private async callOpenAi(system: string, user: string, signal: AbortSignal): Promise<string | null> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) return null;
    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    const responseText = await res.text();
    logThirdPartyCall({ logger: this.callLogger, provider: 'openai', method: 'interpretSearch', url: OPENAI_URL, request: { model: OPENAI_MODEL }, status: res.status, responseText: res.ok ? undefined : responseText, ok: res.ok });
    if (!res.ok) return null;
    const data = JSON.parse(responseText) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content ?? null;
  }
}
