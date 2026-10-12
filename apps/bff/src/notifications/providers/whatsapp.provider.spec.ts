import { ConfigService } from '@nestjs/config';
import type { PinoLogger } from 'nestjs-pino';
import { WhatsappProvider } from './whatsapp.provider';

function makeProvider(env: Record<string, string | undefined> = {}) {
  const config = {
    get: (key: string) =>
      ({
        WHATSAPP_ACCESS_TOKEN: 'access-token',
        WHATSAPP_PHONE_NUMBER_ID: '1234567890123456',
        ...env,
      })[key],
  } as unknown as ConfigService;
  const callLogger = {
    info: jest.fn(),
    error: jest.fn(),
  } as unknown as PinoLogger;
  return new WhatsappProvider(config, callLogger);
}

function mockFetch() {
  const fetchMock = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => '{"messages":[{"id":"wamid.test"}]}',
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe('WhatsappProvider.sendTemplate', () => {
  it.each([undefined, '', '   '])(
    'uses the default Graph API version when the configured version is empty (%s)',
    async (version) => {
      const fetchMock = mockFetch();
      const provider = makeProvider({ WHATSAPP_API_VERSION: version });

      await provider.sendTemplate('9876543210', 'approved_template');

      expect(fetchMock.mock.calls[0][0]).toBe(
        'https://graph.facebook.com/v23.0/1234567890123456/messages',
      );
    },
  );

  it('uses the configured Graph API version when present', async () => {
    const fetchMock = mockFetch();
    const provider = makeProvider({ WHATSAPP_API_VERSION: 'v99.0' });

    await provider.sendTemplate('9876543210', 'approved_template');

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://graph.facebook.com/v99.0/1234567890123456/messages',
    );
  });
});
