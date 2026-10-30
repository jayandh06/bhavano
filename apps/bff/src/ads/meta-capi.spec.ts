import { createHash } from 'crypto';
import { buildMetaEvent, isMetaTraffic, sendMetaConversion } from './meta-capi';

const WHEN = new Date('2026-10-30T10:00:00Z');

describe('isMetaTraffic', () => {
  it('recognises a Meta click id, paid_social, and facebook / instagram sources', () => {
    expect(isMetaTraffic({ fbclid: 'abc' })).toBe(true);
    expect(isMetaTraffic({ medium: 'paid_social' })).toBe(true);
    expect(isMetaTraffic({ source: 'facebook' })).toBe(true);
    expect(isMetaTraffic({ source: 'l.facebook.com', medium: 'referral' })).toBe(true);
    expect(isMetaTraffic({ source: 'instagram' })).toBe(true);
  });

  it('never matches Google or direct traffic', () => {
    expect(isMetaTraffic({ source: 'google', medium: 'cpc' })).toBe(false);
    expect(isMetaTraffic({ source: 'direct' })).toBe(false);
    expect(isMetaTraffic({})).toBe(false);
  });
});

describe('buildMetaEvent', () => {
  it('hashes identifiers the way Meta expects and never sends them in the clear', () => {
    const event = buildMetaEvent({
      eventName: 'Purchase',
      eventId: 'pay_1',
      eventTime: WHEN,
      email: '  Owner@Example.com ',
      phone: '9876543210',
      userId: 'u1',
      fbclid: 'IwAR123',
      fbp: 'fb.1.1700000000000.55',
      value: 499,
      currency: 'INR',
    });
    const json = JSON.stringify(event);
    expect(json).not.toContain('Owner@Example.com');
    expect(json).not.toContain('9876543210');
    expect(event).toMatchObject({
      event_name: 'Purchase',
      event_id: 'pay_1',
      event_time: Math.floor(WHEN.getTime() / 1000),
      action_source: 'website',
      custom_data: { value: 499, currency: 'INR' },
    });
    const userData = event.user_data as Record<string, string[] | string>;
    // Lowercased, trimmed email; phone as digits with the country code and no plus.
    expect(userData.em).toEqual([createHash('sha256').update('owner@example.com').digest('hex')]);
    expect(userData.ph).toEqual([createHash('sha256').update('919876543210').digest('hex')]);
    expect(userData.external_id).toEqual([createHash('sha256').update('u1').digest('hex')]);
    expect(userData.fbp).toBe('fb.1.1700000000000.55');
    expect(userData.fbc).toBe(`fb.1.${WHEN.getTime()}.IwAR123`);
  });

  it('leaves value out unless there is a currency with it', () => {
    expect(buildMetaEvent({ eventName: 'CompleteRegistration', eventId: 's', eventTime: WHEN, userId: 'u' })).not.toHaveProperty('custom_data');
  });
});

describe('sendMetaConversion', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
    jest.restoreAllMocks();
  });

  it('does nothing until the dataset id and token are set', async () => {
    delete process.env.META_PIXEL_ID;
    delete process.env.META_CAPI_ACCESS_TOKEN;
    const fetchSpy = jest.spyOn(global, 'fetch');
    await expect(sendMetaConversion({ eventName: 'CompleteRegistration', eventId: 's', eventTime: WHEN, userId: 'u' })).resolves.toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('posts to the dataset and carries the test code when set', async () => {
    process.env.META_PIXEL_ID = '12345';
    process.env.META_CAPI_ACCESS_TOKEN = 'tok';
    process.env.META_CAPI_TEST_EVENT_CODE = 'TEST1';
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, text: () => Promise.resolve('{}') } as Response);
    await expect(sendMetaConversion({ eventName: 'CompleteRegistration', eventId: 's', eventTime: WHEN, userId: 'u' })).resolves.toBe(true);
    const [url, init] = fetchSpy.mock.calls[0] as [string, { body: string }];
    expect(url).toContain('/12345/events');
    expect(JSON.parse(init.body)).toMatchObject({ access_token: 'tok', test_event_code: 'TEST1' });
  });

  it('skips an event with nothing to match on, and never throws on a network error', async () => {
    process.env.META_PIXEL_ID = '12345';
    process.env.META_CAPI_ACCESS_TOKEN = 'tok';
    const fetchSpy = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('down'));
    await expect(sendMetaConversion({ eventName: 'CompleteRegistration', eventId: 's', eventTime: WHEN })).resolves.toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
    await expect(sendMetaConversion({ eventName: 'CompleteRegistration', eventId: 's', eventTime: WHEN, userId: 'u' })).resolves.toBe(false);
  });
});
