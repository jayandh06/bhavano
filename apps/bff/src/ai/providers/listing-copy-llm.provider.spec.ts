import { resolveListingCopyProvider } from './listing-copy-llm.provider';

describe('resolveListingCopyProvider', () => {
  it('always resolves to stub in a test environment, regardless of configured keys', () => {
    expect(
      resolveListingCopyProvider({ openaiConfigured: true, geminiConfigured: true, isTestEnv: true }),
    ).toBe('stub');
  });

  it('falls back to stub when neither key is configured', () => {
    expect(
      resolveListingCopyProvider({ openaiConfigured: false, geminiConfigured: false, isTestEnv: false }),
    ).toBe('stub');
  });

  it('uses whichever single provider is configured', () => {
    expect(
      resolveListingCopyProvider({ openaiConfigured: true, geminiConfigured: false, isTestEnv: false }),
    ).toBe('openai');
    expect(
      resolveListingCopyProvider({ openaiConfigured: false, geminiConfigured: true, isTestEnv: false }),
    ).toBe('gemini');
  });

  it('prefers Gemini when both are configured and no override is set', () => {
    expect(
      resolveListingCopyProvider({ openaiConfigured: true, geminiConfigured: true, isTestEnv: false }),
    ).toBe('gemini');
  });

  it('an explicit override picks that provider even when the other is also configured', () => {
    expect(
      resolveListingCopyProvider({
        providerOverride: 'openai',
        openaiConfigured: true,
        geminiConfigured: true,
        isTestEnv: false,
      }),
    ).toBe('openai');
  });

  it('an override naming a provider whose key is unset falls back to stub, not the other provider', () => {
    expect(
      resolveListingCopyProvider({
        providerOverride: 'gemini',
        openaiConfigured: true,
        geminiConfigured: false,
        isTestEnv: false,
      }),
    ).toBe('stub');
  });
});
