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

describe('WhatsappProvider.sendTemplateComponents', () => {
  it('posts the ready-made components and returns the Meta message id', async () => {
    const fetchMock = mockFetch();
    const provider = makeProvider();
    const components = [{ type: 'body', parameters: [{ type: 'text', text: '123456' }] }];

    const result = await provider.sendTemplateComponents('919876543210', 'whatsapp_otp', components);

    expect(result).toMatchObject({ ok: true, status: 200, messageId: 'wamid.test' });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.to).toBe('919876543210');
    expect(body.template).toEqual({ name: 'whatsapp_otp', language: { code: 'en' }, components });
  });

  it('adds the 91 prefix to a bare number and omits components when there are none', async () => {
    const fetchMock = mockFetch();
    await makeProvider().sendTemplateComponents('9876543210', 'hello_world', []);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.to).toBe('919876543210');
    expect(body.template.components).toBeUndefined();
  });

  it('reports not configured without calling Meta, and reports Meta errors without throwing', async () => {
    const fetchMock = mockFetch();
    await expect(makeProvider({ WHATSAPP_ACCESS_TOKEN: '' }).sendTemplateComponents('9876543210', 't', [])).resolves.toMatchObject({ ok: false, status: 503 });
    expect(fetchMock).not.toHaveBeenCalled();

    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 400, text: async () => '{"error":{"code":10}}' }) as unknown as typeof fetch;
    await expect(makeProvider().sendTemplateComponents('9876543210', 't', [])).resolves.toMatchObject({ ok: false, status: 400, messageId: null });
  });
});
