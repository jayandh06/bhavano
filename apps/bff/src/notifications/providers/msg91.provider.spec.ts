import { Msg91Provider } from './msg91.provider';
import type { ConfigService } from '@nestjs/config';

/**
 * The payload shape is the whole point of these tests.
 *
 * `ad_boost_instant_alert`'s four body values are positional and unnamed — MSG91 validates that
 * four arrived, never what they mean — so sending the price where the name belongs produces a
 * perfectly successful send of a nonsense message. The same goes for the two button suffixes:
 * swapping them sends someone who clicked "Boost + Instant Alerts" to plain Boost. Neither
 * mistake surfaces anywhere at runtime, which is exactly why it is pinned here.
 */
function makeProvider(env: Record<string, string | undefined> = {}) {
  const config = {
    get: (key: string) =>
      ({
        MSG91_AUTH_KEY: 'key',
        MSG91_WHATSAPP_INTEGRATED_NUMBER: '918667496339',
        MSG91_WHATSAPP_BOOST_PROMO_TEMPLATE_NAME: 'ad_boost_instant_alert',
        MSG91_WHATSAPP_BOOST_PROMO_NAMESPACE: 'b809c8aa_8ca6_40f4_81fd_6d3858c888dc',
        ...env,
      })[key],
  } as unknown as ConfigService;
  return new Msg91Provider(config);
}

const OK_BODY = '{"status":"success","hasError":false,"request_id":"req-1"}';

function mockFetch(body = OK_BODY, ok = true) {
  const fetchMock = jest.fn().mockResolvedValue({ ok, status: ok ? 200 : 400, text: async () => body });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

const VARS = { name: 'Ravi', title: '2 BHK for rent in Koramangala', boostPrice: '100', bundlePrice: '112' };
// The bare id, and the id plus the alerts flag — the template's own base supplies
// `…/checkout?plan=boost&ad=`, so a suffix carrying a path would double up.
const BUTTONS = { boostSuffix: 'abc123', bundleSuffix: 'abc123&withAlerts=1' };

describe('Msg91Provider.sendBoostPromotion', () => {
  it('sends the four body values in the order the approved copy reads, and two button suffixes', async () => {
    const fetchMock = mockFetch();

    const result = await makeProvider().sendBoostPromotion('9876543210', VARS, BUTTONS);

    expect(result).toEqual({ sent: true, messageId: 'req-1' });
    const payload = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
    expect(payload.payload.template.name).toBe('ad_boost_instant_alert');
    expect(payload.payload.template.namespace).toBe('b809c8aa_8ca6_40f4_81fd_6d3858c888dc');
    // 91-prefixed here, not by the caller — every WhatsApp method in this provider does it itself.
    expect(payload.payload.template.to_and_components[0].to).toEqual(['919876543210']);
    expect(payload.payload.template.to_and_components[0].components).toEqual({
      body_1: { type: 'text', value: 'Ravi' },
      body_2: { type: 'text', value: '2 BHK for rent in Koramangala' },
      body_3: { type: 'text', value: '100' },
      body_4: { type: 'text', value: '112' },
      button_1: { subtype: 'url', type: 'text', value: 'abc123' },
      button_2: { subtype: 'url', type: 'text', value: 'abc123&withAlerts=1' },
    });
  });

  it('sends the id alone, since the template base already carries the path', async () => {
    const fetchMock = mockFetch();

    await makeProvider().sendBoostPromotion('9876543210', VARS, BUTTONS);

    const payload = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
    const { button_1, button_2 } = payload.payload.template.to_and_components[0].components;
    // A path here would produce `…ad=my-listings?openBoost=<id>` — the mistake the first version
    // made by assuming claim_listing's bare-domain base.
    expect(button_1.value).toBe('abc123');
    expect(button_2.value).toBe('abc123&withAlerts=1');
    expect(button_1.value).not.toContain('my-listings');
  });

  it.each([
    ['template name', { MSG91_WHATSAPP_BOOST_PROMO_TEMPLATE_NAME: undefined }],
    ['namespace', { MSG91_WHATSAPP_BOOST_PROMO_NAMESPACE: undefined }],
    ['auth key', { MSG91_AUTH_KEY: undefined }],
  ])('skips without sending when the %s is unset', async (_label, env) => {
    const fetchMock = mockFetch();

    const result = await makeProvider(env).sendBoostPromotion('9876543210', VARS, BUTTONS);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual({ sent: false, messageId: null });
  });

  it('reports a failure rather than throwing when MSG91 answers with an error', async () => {
    mockFetch('{"error":"template not found"}', true);

    const result = await makeProvider().sendBoostPromotion('9876543210', VARS, BUTTONS);

    // A body carrying "error" counts as failure even on a 200 — MSG91 does that.
    expect(result).toEqual({ sent: false, messageId: null });
  });
});
