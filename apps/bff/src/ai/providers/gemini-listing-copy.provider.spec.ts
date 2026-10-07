import { ServiceUnavailableException } from '@nestjs/common';
import { GeminiListingCopyProvider } from './gemini-listing-copy.provider';
import type { ConfigService } from '@nestjs/config';
import type { PinoLogger } from 'nestjs-pino';

function makeProvider(config: Record<string, string | undefined> = { GEMINI_API_KEY: 'test-gemini-key' }) {
  const configService = { get: jest.fn((key: string) => config[key]) } as unknown as ConfigService;
  const callLogger = { info: jest.fn(), error: jest.fn() } as unknown as PinoLogger;
  const provider = new GeminiListingCopyProvider(configService, callLogger);
  return { provider, callLogger };
}

function mockFetchOk(jsonText: string): void {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: () => Promise.resolve(JSON.stringify({ candidates: [{ content: { parts: [{ text: jsonText }] } }] })),
  }) as unknown as typeof fetch;
}

const fields = { category: 'apartment', transactionType: 'rent', cityName: 'Bengaluru' } as const;

describe('GeminiListingCopyProvider', () => {
  it('throws if GEMINI_API_KEY is not configured', async () => {
    const { provider } = makeProvider({ GEMINI_API_KEY: undefined });

    await expect(provider.generateTitle(fields)).rejects.toThrow(ServiceUnavailableException);
  });

  it('calls the default model with the api key header and a JSON response config', async () => {
    mockFetchOk(JSON.stringify({ text: 'A nice 2BHK' }));
    const { provider } = makeProvider();

    await provider.generateTitle(fields);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'X-Goog-Api-Key': 'test-gemini-key' }),
      }),
    );
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    // No thinkingConfig — the default model (a "lite" tier) rejects it outright with a 400;
    // see DEFAULT_GEMINI_MODEL's own comment in the provider.
    expect(body.generationConfig).toEqual({ responseMimeType: 'application/json' });
  });

  it('honours a GEMINI_MODEL override', async () => {
    mockFetchOk(JSON.stringify({ text: 'A nice 2BHK' }));
    const { provider } = makeProvider({ GEMINI_API_KEY: 'test-gemini-key', GEMINI_MODEL: 'gemini-flash-lite' });

    await provider.generateTitle(fields);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite:generateContent',
      expect.anything(),
    );
  });

  it('parses the JSON text out of candidates[0].content.parts[0].text', async () => {
    mockFetchOk(JSON.stringify({ text: 'Spacious 2BHK for rent in Bengaluru' }));
    const { provider } = makeProvider();

    const title = await provider.generateTitle(fields);

    expect(title).toBe('Spacious 2BHK for rent in Bengaluru');
  });

  it('returns both languages when the model supplies secondLanguageText', async () => {
    mockFetchOk(JSON.stringify({ text: 'English text', secondLanguageText: 'हिन्दी में विवरण' }));
    const { provider } = makeProvider();

    const result = await provider.generateDescription({
      ...fields,
      tier: 'free',
      landmarks: [],
      secondLanguage: 'hi',
    });

    expect(result).toEqual({ text: 'English text', secondLanguageText: 'हिन्दी में विवरण' });
  });

  it('throws ServiceUnavailableException on a non-OK response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('{}'),
    }) as unknown as typeof fetch;
    const { provider } = makeProvider();

    await expect(provider.generateTitle(fields)).rejects.toThrow(ServiceUnavailableException);
  });

  it('throws ServiceUnavailableException when the response has no candidates text', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify({ candidates: [] })),
    }) as unknown as typeof fetch;
    const { provider } = makeProvider();

    await expect(provider.generateTitle(fields)).rejects.toThrow(ServiceUnavailableException);
  });
});
