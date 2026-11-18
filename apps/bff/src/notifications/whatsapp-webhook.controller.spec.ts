import { ForbiddenException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { extractMetaStatuses, WhatsappWebhookController } from './whatsapp-webhook.controller';

const SECRET = 'app-secret';

function make(env: Record<string, string | undefined> = {}) {
  const prisma = {
    whatsappWebhookEvent: { create: jest.fn().mockResolvedValue({}) },
    listingNotificationLog: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
  const config = { get: (k: string) => ({ WHATSAPP_APP_SECRET: SECRET, WHATSAPP_WEBHOOK_VERIFY_TOKEN: 'verify', ...env })[k] };
  const controller = new WhatsappWebhookController(prisma as never, config as never);
  return { controller, prisma };
}

const payload = {
  entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.A', status: 'Delivered' }, { id: 'wamid.B', status: 'failed', errors: [{ code: 131042, title: 'Payment issue' }] }] } }] }],
};
const sign = (raw: Buffer, secret = SECRET) => `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`;

describe('extractMetaStatuses', () => {
  it('reads statuses and the first error, lowercasing the status', () => {
    expect(extractMetaStatuses(payload)).toEqual([
      { messageId: 'wamid.A', status: 'delivered', errorCode: null, errorTitle: null },
      { messageId: 'wamid.B', status: 'failed', errorCode: 131042, errorTitle: 'Payment issue' },
    ]);
  });
  it('ignores bodies with no statuses', () => {
    expect(extractMetaStatuses({ entry: [{ changes: [{ value: { messages: [{}] } }] }] })).toEqual([]);
    expect(extractMetaStatuses(null)).toEqual([]);
    expect(extractMetaStatuses('x')).toEqual([]);
  });
});

describe('WhatsappWebhookController Meta routes', () => {
  it('echoes the challenge only for the right mode and verify token', () => {
    const { controller } = make();
    expect(controller.verifyMeta('subscribe', 'verify', '42')).toBe('42');
    expect(() => controller.verifyMeta('subscribe', 'nope', '42')).toThrow(ForbiddenException);
    expect(() => controller.verifyMeta('unsubscribe', 'verify', '42')).toThrow(ForbiddenException);
    expect(() => make({ WHATSAPP_WEBHOOK_VERIFY_TOKEN: undefined }).controller.verifyMeta('subscribe', 'x', '42')).toThrow(ForbiddenException);
  });

  it('rejects a missing, wrong or unconfigured signature and stores nothing', async () => {
    const raw = Buffer.from(JSON.stringify(payload));
    const { controller, prisma } = make();
    await expect(controller.handleMetaStatus({ rawBody: raw } as never, undefined, payload)).rejects.toThrow(ForbiddenException);
    await expect(controller.handleMetaStatus({ rawBody: raw } as never, sign(raw, 'other'), payload)).rejects.toThrow(ForbiddenException);
    const unconfigured = make({ WHATSAPP_APP_SECRET: undefined });
    await expect(unconfigured.controller.handleMetaStatus({ rawBody: raw } as never, sign(raw), payload)).rejects.toThrow(ForbiddenException);
    expect(prisma.whatsappWebhookEvent.create).not.toHaveBeenCalled();
  });

  it('stores the event and updates the log row for each status when the signature is valid', async () => {
    const raw = Buffer.from(JSON.stringify(payload));
    const { controller, prisma } = make();
    await expect(controller.handleMetaStatus({ rawBody: raw } as never, sign(raw), payload)).resolves.toEqual({ received: true });
    expect(prisma.whatsappWebhookEvent.create).toHaveBeenCalledTimes(1);
    expect(prisma.listingNotificationLog.updateMany).toHaveBeenCalledTimes(2);
    expect(prisma.listingNotificationLog.updateMany.mock.calls[0][0].where).toEqual({ providerMessageId: 'wamid.A' });
    expect(prisma.listingNotificationLog.updateMany.mock.calls[0][0].data.deliveryStatus).toBe('delivered');
  });
});
