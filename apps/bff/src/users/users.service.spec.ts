import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { ListingSlotsService } from '../listing-slots/listing-slots.service';
import { NotificationsService } from '../notifications/notifications.service';

function userRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    name: null,
    phone: '+919876543210',
    email: null,
    cityId: null,
    city: null,
    sellerType: null,
    agencyName: null,
    reraNumber: null,
    reraVerifiedAt: null,
    emailVerifiedAt: null,
    premiumUntil: null,
    agentProUntil: null,
    agentProUnits: 1,
    sellerSlotPackUntil: null,
    welcomedAt: null,
    ...overrides,
  };
}

function makeService(beforeRow: Record<string, unknown>, updatedRow: Record<string, unknown> = {}) {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(beforeRow),
      update: jest.fn().mockResolvedValue(userRow({ ...beforeRow, ...updatedRow })),
    },
    userNotificationLog: { create: jest.fn() },
  } as unknown as PrismaService;
  const listingSlotsService = {
    getSummary: jest.fn().mockResolvedValue({ activeCount: 0, allowance: 2 }),
  } as unknown as ListingSlotsService;
  const notificationsService = {
    sendWelcomeWhatsapp: jest.fn().mockResolvedValue('whatsapp'),
  } as unknown as NotificationsService;
  const service = new UsersService(prisma, listingSlotsService, notificationsService);
  return { service, prisma, notificationsService };
}

describe("UsersService.updateProfile — the deferred welcome WhatsApp's own name arrives", () => {
  it('sends the welcome WhatsApp with the real name when a phone-only user first supplies one', async () => {
    const { service, prisma, notificationsService } = makeService(
      userRow({ name: null, phone: '+919876543210', email: null, welcomedAt: null }),
    );

    await service.updateProfile('u1', { name: 'Asha Rao' });

    expect(notificationsService.sendWelcomeWhatsapp).toHaveBeenCalledWith({
      name: 'Asha Rao',
      phone: '+919876543210',
    });
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u1' }, data: { welcomedAt: expect.any(Date) } }),
    );
  });

  it('logs the send to userNotificationLog once the channel resolves', async () => {
    const { service, prisma } = makeService(userRow({ name: null, welcomedAt: null }));

    await service.updateProfile('u1', { name: 'Asha Rao' });
    // The log write is chained off the fire-and-forget send promise — flush microtasks.
    await new Promise(process.nextTick);

    expect(prisma.userNotificationLog.create).toHaveBeenCalledWith({
      data: { userId: 'u1', kind: 'welcome', channel: 'whatsapp' },
    });
  });

  it('does not re-send once already welcomed', async () => {
    const { service, notificationsService } = makeService(
      userRow({ name: null, welcomedAt: new Date('2026-01-01') }),
    );

    await service.updateProfile('u1', { name: 'Asha Rao' });

    expect(notificationsService.sendWelcomeWhatsapp).not.toHaveBeenCalled();
  });

  it('does not fire on an edit that is not the first name (profile already had one)', async () => {
    const { service, notificationsService } = makeService(userRow({ name: 'Old Name', welcomedAt: null }));

    await service.updateProfile('u1', { name: 'New Name' });

    expect(notificationsService.sendWelcomeWhatsapp).not.toHaveBeenCalled();
  });

  it('does not fire for a user with an email on file — that signup already got its welcome at login', async () => {
    const { service, notificationsService } = makeService(
      userRow({ name: null, email: 'a@example.com', welcomedAt: null }),
    );

    await service.updateProfile('u1', { name: 'Asha Rao' });

    expect(notificationsService.sendWelcomeWhatsapp).not.toHaveBeenCalled();
  });

  it('does not fire when the profile update omits name entirely (e.g. just a city change)', async () => {
    const { service, notificationsService } = makeService(userRow({ name: null, welcomedAt: null }));

    await service.updateProfile('u1', { cityId: undefined });

    expect(notificationsService.sendWelcomeWhatsapp).not.toHaveBeenCalled();
  });
});
