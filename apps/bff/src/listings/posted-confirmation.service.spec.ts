import { ForbiddenException } from '@nestjs/common';
import { PostedConfirmationService } from './posted-confirmation.service';

const owner = { email: 'a@b.c', phone: '9876543210', name: 'Ravi' };
const listing = {
  id: 'l1',
  slug: 's',
  category: 'apartment',
  transactionType: 'rent',
  title: 'T',
  ownerId: 'u1',
  publishState: 'live',
  moderationState: 'approved',
  city: { name: 'Bengaluru' },
  area: { name: 'Hebbal' },
  owner,
  notificationLogs: [] as unknown[],
};

function make(delayMinutes: number | null = null, row: Partial<typeof listing> | null = {}) {
  const prisma = {
    listing: {
      findUnique: jest.fn().mockResolvedValue(row === null ? null : { ...listing, ...row }),
      findMany: jest.fn().mockResolvedValue([{ id: 'l1' }]),
    },
    listingNotificationLog: { create: jest.fn().mockResolvedValue({}) },
    postedConfirmationSetting: {
      findUnique: jest.fn().mockResolvedValue(delayMinutes === null ? null : { delayMinutes }),
    },
  };
  const notifications = { notifyListingPosted: jest.fn().mockResolvedValue({ channel: 'email', messageId: null }) };
  const service = new PostedConfirmationService(prisma as never, notifications as never);
  return { service, prisma, notifications };
}

describe('PostedConfirmationService', () => {
  it('sends once and records it', async () => {
    const { service, notifications, prisma } = make();
    await expect(service.send('l1')).resolves.toBe(true);
    expect(notifications.notifyListingPosted).toHaveBeenCalledTimes(1);
    expect(prisma.listingNotificationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ listingId: 'l1', kind: 'posted', channel: 'email' }) }),
    );
  });

  it('does not send twice', async () => {
    const { service, notifications } = make(null, { notificationLogs: [{ id: 'x' }] });
    await expect(service.send('l1')).resolves.toBe(false);
    expect(notifications.notifyListingPosted).not.toHaveBeenCalled();
  });

  it('does not send for an ad that is not live yet', async () => {
    const { service, notifications } = make(null, { publishState: 'pending_checkout' });
    await expect(service.send('l1')).resolves.toBe(false);
    expect(notifications.notifyListingPosted).not.toHaveBeenCalled();
  });

  it('release is for the ad owner only', async () => {
    const { service, notifications } = make();
    await expect(service.release('l1', 'someone-else')).rejects.toBeInstanceOf(ForbiddenException);
    expect(notifications.notifyListingPosted).not.toHaveBeenCalled();
    await service.release('l1', 'u1');
    expect(notifications.notifyListingPosted).toHaveBeenCalledTimes(1);
  });

  it('the sweep uses the admin-set delay and only looks at recent, unsent browser/app posts older than the delay', async () => {
    const { service, prisma } = make(30);
    const now = new Date('2026-10-21T10:00:00Z');
    await expect(service.sendDue(now)).resolves.toBe(1);
    const where = prisma.listing.findMany.mock.calls[0][0].where;
    expect(where.createSessionId).toEqual({ not: null });
    expect(where.notificationLogs).toEqual({ none: { kind: 'posted' } });
    expect(where.publishedAt.lte.toISOString()).toBe('2026-10-21T09:30:00.000Z');
    expect(where.publishedAt.gte.toISOString()).toBe('2026-10-21T04:00:00.000Z');
  });

  it('waits 60 minutes until an admin saves a value', async () => {
    const { service, prisma } = make();
    await service.sendDue(new Date('2026-10-21T10:00:00Z'));
    expect(prisma.listing.findMany.mock.calls[0][0].where.publishedAt.lte.toISOString()).toBe('2026-10-21T09:00:00.000Z');
  });

  it('falls back to 60 minutes if the setting cannot be read', async () => {
    const { service, prisma } = make();
    prisma.postedConfirmationSetting.findUnique.mockRejectedValue(new Error('relation does not exist'));
    await service.sendDue(new Date('2026-10-21T10:00:00Z'));
    expect(prisma.listing.findMany.mock.calls[0][0].where.publishedAt.lte.toISOString()).toBe('2026-10-21T09:00:00.000Z');
  });
});
