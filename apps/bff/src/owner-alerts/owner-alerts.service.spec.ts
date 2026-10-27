import { OwnerAlertsService, type OwnerAlert } from './owner-alerts.service';

function setup(opts: { channels?: string[] | null; phone?: string | null; email?: string | null; device?: boolean; whatsapp?: boolean; sms?: boolean; emailOk?: boolean }) {
  const prisma = {
    ownerAlertPreference: {
      findUnique: jest.fn().mockResolvedValue(opts.channels ? { channels: opts.channels } : null),
      upsert: jest.fn().mockResolvedValue({}),
    },
    user: { findUnique: jest.fn().mockResolvedValue({ phone: opts.phone ?? null, email: opts.email ?? null }) },
    pushToken: { findFirst: jest.fn().mockResolvedValue(opts.device ? { id: 't' } : null) },
  };
  const push = { notifyContactRevealed: jest.fn().mockResolvedValue(!!opts.device) };
  const msg91 = {
    sendOwnerAlert: jest.fn().mockResolvedValue({ sent: !!opts.whatsapp, messageId: null }),
    sendOwnerAlertSms: jest.fn().mockResolvedValue(!!opts.sms),
  };
  const notifications = { sendOwnerAlertEmail: jest.fn().mockResolvedValue(!!opts.email) };
  const service = new OwnerAlertsService(prisma as never, push as never, msg91 as never, notifications as never);
  return { service, prisma, push, msg91, notifications };
}

const message: OwnerAlert = { kind: 'message', listingId: 'l1', listingTitle: 'Flat', name: 'Riya', conversationId: 'c1' };

describe('OwnerAlertsService.alert', () => {
  it('stops at the app when the owner has a device (default order)', async () => {
    const t = setup({ device: true, phone: '9876543210', whatsapp: true });
    await expect(t.service.alert('o1', message)).resolves.toBe('push');
    expect(t.msg91.sendOwnerAlert).not.toHaveBeenCalled();
  });

  it('falls to WhatsApp for a phone-only owner with no app', async () => {
    const t = setup({ phone: '9876543210', whatsapp: true });
    await expect(t.service.alert('o1', message)).resolves.toBe('whatsapp');
    expect(t.msg91.sendOwnerAlert).toHaveBeenCalledWith('9876543210', 'message', { title: 'Flat', name: 'Riya', buttonSuffix: 'c1' });
  });

  it('skips WhatsApp while its template is not configured, then SMS, and ends on email', async () => {
    const t = setup({ phone: '9876543210', email: 'a@b.com' });
    await expect(t.service.alert('o1', message)).resolves.toBe('email');
    expect(t.notifications.sendOwnerAlertEmail).toHaveBeenCalledWith(expect.anything(), 'message', { title: 'Flat', name: 'Riya' }, 'c1');
  });

  it('returns null when nothing can reach the owner', async () => {
    const t = setup({ phone: '9876543210' });
    await expect(t.service.alert('o1', message)).resolves.toBeNull();
  });

  it('honours the chosen order: email first beats WhatsApp', async () => {
    const t = setup({ channels: ['email', 'whatsapp'], phone: '9876543210', email: 'a@b.com', whatsapp: true });
    await expect(t.service.alert('o1', message)).resolves.toBe('email');
    expect(t.msg91.sendOwnerAlert).not.toHaveBeenCalled();
  });

  it('sends the reveal push itself, and the reveal WhatsApp points at My listings', async () => {
    const reveal: OwnerAlert = { kind: 'reveal', listingId: 'l1', listingTitle: 'Flat' };
    const withApp = setup({ device: true });
    await expect(withApp.service.alert('o1', reveal)).resolves.toBe('push');
    expect(withApp.push.notifyContactRevealed).toHaveBeenCalled();
    const phoneOnly = setup({ phone: '9876543210', whatsapp: true });
    await phoneOnly.service.alert('o1', reveal);
    expect(phoneOnly.msg91.sendOwnerAlert).toHaveBeenCalledWith('9876543210', 'reveal', expect.objectContaining({ buttonSuffix: 'my-listings' }));
  });

  it('never throws', async () => {
    const t = setup({});
    t.prisma.user.findUnique.mockRejectedValue(new Error('db down'));
    await expect(t.service.alert('o1', message)).resolves.toBeNull();
  });
});

describe('OwnerAlertsService preference', () => {
  it('is unconfirmed with the default order until chosen, and reports reachability', async () => {
    const t = setup({ phone: '9876543210', device: false });
    const pref = await t.service.getPreference('o1');
    expect(pref).toEqual({
      channels: ['push', 'whatsapp', 'sms', 'email'],
      confirmed: false,
      available: { push: false, whatsapp: true, sms: true, email: false },
    });
  });

  it('stores a complete order even when given a partial one', async () => {
    const t = setup({});
    await t.service.setPreference('o1', ['sms', 'sms', 'bogus']);
    expect(t.prisma.ownerAlertPreference.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: { userId: 'o1', channels: ['sms', 'push', 'whatsapp', 'email'] } }),
    );
  });
});
