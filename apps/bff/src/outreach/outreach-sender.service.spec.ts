import type { ConfigService } from '@nestjs/config';
import { OutreachSenderService } from './outreach-sender.service';

function makeSender(env: Record<string, string>) {
  const config = { get: (key: string) => env[key] } as unknown as ConfigService;
  return new OutreachSenderService(config);
}

const ENABLED = { MSG91_MARKETING_ENABLED: 'true', MSG91_AUTH_KEY: 'key' };

describe('OutreachSenderService.send (sms)', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ request_id: 'req1' }) });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('sends only the recipient and template id for a variable-free template', async () => {
    const sender = makeSender(ENABLED);

    const result = await sender.send('sms', '+919876543210', 'Hi Partner, ... STOP', '1777179196588086293');

    expect(result).toEqual({ ok: true, providerRef: 'req1' });
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({
      template_id: '1777179196588086293',
      recipients: [{ mobiles: '919876543210' }],
    });
  });

  it('refuses to send when marketing sending is disabled', async () => {
    const sender = makeSender({ MSG91_AUTH_KEY: 'key' });

    const result = await sender.send('sms', '+919876543210', 'body', 'DLT1');

    expect(result.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails without a DLT template id', async () => {
    const sender = makeSender(ENABLED);

    const result = await sender.send('sms', '+919876543210', 'body', null);

    expect(result).toEqual({ ok: false, error: 'Missing DLT template id' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
