import { UsersService } from './users.service';

// Only getProfileNudge / snoozeProfileNudge are exercised; everything else the service needs is unused here.
function makeService(opts: { user: Record<string, unknown>; phoneRequirement?: string; emailLogin?: string }) {
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue(opts.user), update: jest.fn().mockResolvedValue({}) },
    loginSetting: { findUnique: jest.fn().mockResolvedValue(opts.phoneRequirement ? { emailLogin: opts.emailLogin ?? 'all', phoneRequirement: opts.phoneRequirement } : null) },
  };
  const service = new UsersService(prisma as never, {} as never, {} as never);
  return { service, prisma };
}

const emailOnly = { email: 'a@b.com', phone: null, profileNudgeCount: 3, profileNudgeSnoozedUntil: null };

describe('profile nudge while moving accounts to mobile', () => {
  it('"required": an account with no phone gets an undismissable prompt even after the ordinary nudge cap', async () => {
    const { service } = makeService({ user: emailOnly, phoneRequirement: 'required' });
    await expect(service.getProfileNudge('u1')).resolves.toMatchObject({ show: true, blocking: true });
  });

  it('the migration login mode forces the undismissable prompt even when the phone setting is off', async () => {
    const { service } = makeService({ user: emailOnly, phoneRequirement: 'off', emailLogin: 'existing_no_phone' });
    await expect(service.getProfileNudge('u1')).resolves.toMatchObject({ show: true, blocking: true });
  });

  it('"required": an account that already has a phone is left alone', async () => {
    const { service } = makeService({ user: { ...emailOnly, phone: '9876543210' }, phoneRequirement: 'required' });
    const nudge = await service.getProfileNudge('u1');
    expect(nudge.blocking).toBeUndefined();
  });

  it('"ask": shows again daily (ignores the lifetime cap) and respects a one-day snooze', async () => {
    const asked = makeService({ user: emailOnly, phoneRequirement: 'ask' });
    await expect(asked.service.getProfileNudge('u1')).resolves.toMatchObject({ show: true });
    const snoozed = makeService({ user: { ...emailOnly, profileNudgeSnoozedUntil: new Date(Date.now() + 3_600_000) }, phoneRequirement: 'ask' });
    await expect(snoozed.service.getProfileNudge('u1')).resolves.toMatchObject({ show: false });
  });

  it('off: the ordinary capped nudge applies as before', async () => {
    const { service } = makeService({ user: emailOnly });
    await expect(service.getProfileNudge('u1')).resolves.toMatchObject({ show: false });
  });

  it('"not now" while moving to mobile snoozes for a day and does not use up the lifetime cap', async () => {
    const { service, prisma } = makeService({ user: emailOnly, phoneRequirement: 'ask' });
    await service.snoozeProfileNudge('u1');
    const data = (prisma.user.update.mock.calls[0][0] as { data: { profileNudgeSnoozedUntil: Date; profileNudgeCount?: unknown } }).data;
    expect(data.profileNudgeCount).toBeUndefined();
    expect(data.profileNudgeSnoozedUntil.getTime() - Date.now()).toBeLessThan(25 * 3_600_000);
  });
});
