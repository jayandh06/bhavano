import { Msg91Provider } from './msg91.provider';
import type { ConfigService } from '@nestjs/config';

/**
 * The payload shape is the whole point of these tests.
 *
 * `ad_boost_instant_alert_1`'s four body values are positional and unnamed — MSG91 validates that
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
        MSG91_WHATSAPP_BOOST_PROMO_TEMPLATE_NAME: 'ad_boost_instant_alert_1',
        // This template carries no namespace — null is its correct value, not a missing setting.
        MSG91_WHATSAPP_BOOST_PROMO_NAMESPACE: undefined,
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

const VARS = {
  name: 'Ravi',
  title: '2 BHK for rent in Koramangala',
  location: 'Koramangala, Bengaluru',
  offerEnds: '30 September',
};
// Whole paths: ad_boost_instant_alert_1's base resolves these directly.
const BUTTONS = {
  boostSuffix: 'my-listings?openBoost=abc123',
  bundleSuffix: 'my-listings?openBoost=abc123&withAlerts=1',
};

describe('Msg91Provider.sendBoostPromotion', () => {
  it('sends the four body values in the order the approved copy reads, and two button suffixes', async () => {
    const fetchMock = mockFetch();

    const result = await makeProvider().sendBoostPromotion('9876543210', VARS, BUTTONS);

    expect(result).toEqual({ sent: true, messageId: 'req-1' });
    const payload = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
    expect(payload.payload.template.name).toBe('ad_boost_instant_alert_1');
    expect(payload.payload.template.namespace).toBeNull();
    // 91-prefixed here, not by the caller — every WhatsApp method in this provider does it itself.
    expect(payload.payload.template.to_and_components[0].to).toEqual(['919876543210']);
    expect(payload.payload.template.to_and_components[0].components).toEqual({
      body_1: { type: 'text', value: 'Ravi' },
      body_2: { type: 'text', value: '2 BHK for rent in Koramangala' },
      body_3: { type: 'text', value: 'Koramangala, Bengaluru' },
      body_4: { type: 'text', value: '30 September' },
      button_1: { subtype: 'url', type: 'text', value: 'my-listings?openBoost=abc123' },
      button_2: { subtype: 'url', type: 'text', value: 'my-listings?openBoost=abc123&withAlerts=1' },
    });
  });

  it('carries the whole path in each button suffix', async () => {
    const fetchMock = mockFetch();

    await makeProvider().sendBoostPromotion('9876543210', VARS, BUTTONS);

    const payload = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
    const { button_1, button_2 } = payload.payload.template.to_and_components[0].components;
    expect(button_1.value).toBe('my-listings?openBoost=abc123');
    expect(button_2.value).toBe('my-listings?openBoost=abc123&withAlerts=1');
  });

  // Deliberately no namespace case: null is this template's correct value, so requiring it would
  // skip every send — which is what an earlier version did.
  it.each([
    ['template name', { MSG91_WHATSAPP_BOOST_PROMO_TEMPLATE_NAME: undefined }],
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
