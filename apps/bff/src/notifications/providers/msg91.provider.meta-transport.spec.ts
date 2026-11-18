import { Msg91Provider } from './msg91.provider';
import type { ConfigService } from '@nestjs/config';
import type { PinoLogger } from 'nestjs-pino';
import type { WhatsappProvider } from './whatsapp.provider';

/** WHATSAPP_TRANSPORT=meta: the MSG91-shaped sends go straight to Meta. See docs/plans/whatsapp-direct-meta-transport.md. */
function make(env: Record<string, string | undefined>, meta?: Partial<WhatsappProvider>) {
  const config = {
    get: (key: string) =>
      ({
        MSG91_AUTH_KEY: 'key',
        MSG91_WHATSAPP_INTEGRATED_NUMBER: '918667496339',
        MSG91_WHATSAPP_OTP_TEMPLATE_NAME: 'whatsapp_otp',
        MSG91_WHATSAPP_OTP_NAMESPACE: 'ns',
        MSG91_WHATSAPP_BOOST_PROMO_TEMPLATE_NAME: 'ad_boost_instant_alert_1',
        ...env,
      })[key],
  } as unknown as ConfigService;
  const callLogger = { info: jest.fn(), error: jest.fn() } as unknown as PinoLogger;
  return new Msg91Provider(config, callLogger, meta as WhatsappProvider);
}

describe('Msg91Provider WhatsApp sends with WHATSAPP_TRANSPORT=meta', () => {
  afterEach(() => jest.restoreAllMocks());

  it('sends the OTP template through Meta with the code as body and copy-code button, and never calls MSG91', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    const sendTemplateComponents = jest.fn().mockResolvedValue({ ok: true, status: 200, responseText: '{}', messageId: 'wamid.X' });
    const provider = make({ WHATSAPP_TRANSPORT: 'meta' }, { configured: true, sendTemplateComponents } as never);

    await expect(provider.sendWhatsappOtp('9876543210', '654321')).resolves.toBe(true);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(sendTemplateComponents).toHaveBeenCalledWith('919876543210', 'whatsapp_otp', [
      { type: 'body', parameters: [{ type: 'text', text: '654321' }] },
      { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: '654321' }] },
    ]);
  });

  it('returns the Meta message id as the send id, so delivery tracking keeps working', async () => {
    const sendTemplateComponents = jest.fn().mockResolvedValue({ ok: true, status: 200, responseText: '{}', messageId: 'wamid.ABC' });
    const provider = make({ WHATSAPP_TRANSPORT: 'meta' }, { configured: true, sendTemplateComponents } as never);
    const result = await provider.sendBoostPromotion(
      '9876543210',
      { name: 'Ravi', title: '2 BHK', location: 'Koramangala', offerEnds: '30 September' },
      { boostSuffix: 'my-listings?openBoost=a', bundleSuffix: 'my-listings?openBoost=a&withAlerts=1' },
    );
    expect(result).toEqual({ sent: true, messageId: 'wamid.ABC' });
    const components = sendTemplateComponents.mock.calls[0][2];
    expect(components[0].parameters.map((p: { text: string }) => p.text)).toEqual(['Ravi', '2 BHK', '30 September', 'Koramangala']);
    expect(components.slice(1).map((c: { index: string }) => c.index)).toEqual(['0', '1']);
  });

  it('reports failure (so OTP falls back to SMS) when Meta rejects the send', async () => {
    const sendTemplateComponents = jest.fn().mockResolvedValue({ ok: false, status: 400, responseText: '{"error":{"message":"nope"}}', messageId: null });
    const provider = make({ WHATSAPP_TRANSPORT: 'meta' }, { configured: true, sendTemplateComponents } as never);
    await expect(provider.sendWhatsappOtp('9876543210', '111111')).resolves.toBe(false);
  });

  it('reports failure without calling anything when the direct sender is not configured', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    const sendTemplateComponents = jest.fn();
    const provider = make({ WHATSAPP_TRANSPORT: 'meta' }, { configured: false, sendTemplateComponents } as never);
    await expect(provider.sendWhatsappOtp('9876543210', '111111')).resolves.toBe(false);
    expect(sendTemplateComponents).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([undefined, 'msg91'])('keeps using MSG91 when WHATSAPP_TRANSPORT is %s', async (transport) => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '{"status":"success","request_id":"r"}' });
    global.fetch = fetchMock as unknown as typeof fetch;
    const sendTemplateComponents = jest.fn();
    const provider = make({ WHATSAPP_TRANSPORT: transport }, { configured: true, sendTemplateComponents } as never);
    await expect(provider.sendWhatsappOtp('9876543210', '222222')).resolves.toBe(true);
    expect(fetchMock.mock.calls[0][0]).toContain('api.msg91.com');
    expect(sendTemplateComponents).not.toHaveBeenCalled();
  });
});
