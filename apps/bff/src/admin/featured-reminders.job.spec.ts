import { BoostFollowupJob } from './boost-followup.job';
import { FeaturedExpiryReminderJob } from './featured-expiry-reminder.job';
import { buildExpiryReminderBody, buildExpiryReminderCard, expiryReminderPath } from './boost-message';
import type { PrismaService } from '../prisma/prisma.service';
import type { AdminService } from './admin.service';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-10-26T05:00:00Z');

describe('expiry reminder wording', () => {
  const input = {
    title: '2 BHK in Adyar',
    location: 'Adyar, Chennai',
    daysLeft: 3,
    endsOn: '29 October',
    renewDays: 7,
    renewPrice: 99,
    renewLink: 'https://www.bhavano.com/my-listings?openBoost=l1&src=featured_expiry_message',
  };

  it('opens with the whole point, since that sentence is the push preview', () => {
    expect(buildExpiryReminderBody(input).split('\n\n')[0]).toBe(
      'Your Featured ad "2 BHK in Adyar" ends in 3 days (29 October). Renew to keep it above other listings.',
    );
    expect(buildExpiryReminderBody({ ...input, daysLeft: 1 })).toContain('ends tomorrow (29 October)');
  });

  it('says the remaining days are kept and links to the Feature dialog tagged as the reminder', () => {
    const body = buildExpiryReminderBody(input);
    expect(body).toContain('The days you have left are kept');
    expect(body).toContain('₹99');
    const card = buildExpiryReminderCard(input, { id: 'l1', category: 'apartment', imageUrl: null });
    expect(card.kind).toBe('boost_offer');
    expect(card.headline).toBe('Your Featured ad ends in 3 days');
    expect(card.ctaLabel).toBe('Renew Feature · ₹99');
    expect(card.ctaPath).toBe(expiryReminderPath('l1'));
    expect(card.ctaPath).toBe('/my-listings?openBoost=l1&src=featured_expiry_message');
  });
});

function makeExpiryJob(
  candidates: Array<{
    id: string;
    boostedUntil: Date;
    listingBoosts?: Array<{ boostedFrom: Date }>;
    notificationLogs?: Array<{ sentAt: Date }>;
  }>,
) {
  const findMany = jest.fn().mockImplementation(({ where }: { where: { boostedUntil: { gt: Date; lte: Date } } }) =>
    Promise.resolve(
      candidates
        .filter((c) => c.boostedUntil > where.boostedUntil.gt && c.boostedUntil <= where.boostedUntil.lte)
        .map((c) => ({ listingBoosts: [], notificationLogs: [], ...c })),
    ),
  );
  const prisma = {
    listing: { findMany },
    user: { findFirst: jest.fn().mockResolvedValue({ id: 'admin1' }) },
  } as unknown as PrismaService;
  const adminService = { sendFeaturedExpiryReminder: jest.fn().mockResolvedValue(true) } as unknown as AdminService;
  return { job: new FeaturedExpiryReminderJob(prisma, adminService), adminService };
}

describe('FeaturedExpiryReminderJob', () => {
  afterEach(() => {
    delete process.env.FEATURED_EXPIRY_REMINDER_ENABLED;
  });

  it('sends the 3-day reminder at 2 to 3 days left and the 1-day reminder inside the last day, never early', async () => {
    const { job, adminService } = makeExpiryJob([
      { id: 'three', boostedUntil: new Date(NOW.getTime() + 2.5 * DAY), listingBoosts: [{ boostedFrom: new Date(NOW.getTime() - 4.5 * DAY) }] },
      { id: 'one', boostedUntil: new Date(NOW.getTime() + 0.5 * DAY), listingBoosts: [{ boostedFrom: new Date(NOW.getTime() - 6.5 * DAY) }] },
      { id: 'far', boostedUntil: new Date(NOW.getTime() + 5 * DAY) },
    ]);
    expect(await job.sendReminders(NOW)).toBe(2);
    expect(adminService.sendFeaturedExpiryReminder).toHaveBeenCalledWith('three', 3, 'admin1');
    expect(adminService.sendFeaturedExpiryReminder).toHaveBeenCalledWith('one', 1, 'admin1');
    expect(adminService.sendFeaturedExpiryReminder).toHaveBeenCalledTimes(2);
  });

  it('does not repeat a reminder within one Feature period, but reminds again after a renewal', async () => {
    const periodStart = new Date(NOW.getTime() - 4.5 * DAY);
    const { job, adminService } = makeExpiryJob([
      {
        id: 'done',
        boostedUntil: new Date(NOW.getTime() + 2.5 * DAY),
        listingBoosts: [{ boostedFrom: periodStart }],
        notificationLogs: [{ sentAt: new Date(periodStart.getTime() + DAY) }],
      },
      {
        id: 'renewed',
        boostedUntil: new Date(NOW.getTime() + 2.5 * DAY),
        listingBoosts: [{ boostedFrom: periodStart }],
        notificationLogs: [{ sentAt: new Date(periodStart.getTime() - 30 * DAY) }],
      },
    ]);
    await job.sendReminders(NOW);
    expect(adminService.sendFeaturedExpiryReminder).toHaveBeenCalledTimes(1);
    expect(adminService.sendFeaturedExpiryReminder).toHaveBeenCalledWith('renewed', 3, 'admin1');
  });

  it('skips the 3-day reminder for a Feature period of 3 days or less', async () => {
    const { job, adminService } = makeExpiryJob([
      { id: 'short', boostedUntil: new Date(NOW.getTime() + 2.5 * DAY), listingBoosts: [{ boostedFrom: new Date(NOW.getTime() - 0.4 * DAY) }] },
    ]);
    expect(await job.sendReminders(NOW)).toBe(0);
    expect(adminService.sendFeaturedExpiryReminder).not.toHaveBeenCalled();
  });

  it('can be switched off', async () => {
    process.env.FEATURED_EXPIRY_REMINDER_ENABLED = 'false';
    const { job, adminService } = makeExpiryJob([{ id: 'x', boostedUntil: new Date(NOW.getTime() + 0.5 * DAY) }]);
    await job.run();
    expect(adminService.sendFeaturedExpiryReminder).not.toHaveBeenCalled();
  });
});

describe('BoostFollowupJob', () => {
  afterEach(() => {
    delete process.env.BOOST_FOLLOWUP_ENABLED;
  });

  function makeFollowup(opts: { byStage: Record<string, Array<{ id: string; ownerId: string }>>; sendResult?: { sent: number; error?: string } }) {
    const findMany = jest.fn().mockImplementation(({ where }: { where: { AND: Array<{ notificationLogs: { none: { kind: string } } }> } }) =>
      Promise.resolve(opts.byStage[where.AND[0].notificationLogs.none.kind] ?? []),
    );
    const create = jest.fn().mockResolvedValue({});
    const prisma = {
      listing: { findMany },
      listingNotificationLog: { create },
      user: { findFirst: jest.fn().mockResolvedValue({ id: 'admin1' }) },
    } as unknown as PrismaService;
    const result = opts.sendResult ?? { sent: 1 };
    const sendBoostPromotion = jest.fn().mockImplementation((ids: string[]) =>
      Promise.resolve({
        sent: result.sent,
        failed: 1 - result.sent,
        results: ids.map((listingId) => ({ listingId, success: result.sent > 0, error: result.error })),
      }),
    );
    const adminService = { sendBoostPromotion } as unknown as AdminService;
    return { job: new BoostFollowupJob(prisma, adminService), sendBoostPromotion, create };
  }

  it('sends each stage through the existing Boost message, past the cooldown, and records the stage', async () => {
    const { job, sendBoostPromotion, create } = makeFollowup({
      byStage: { boost_followup_4h: [{ id: 'a', ownerId: 'o1' }], boost_followup_1d: [{ id: 'b', ownerId: 'o2' }], boost_followup_3d: [{ id: 'c', ownerId: 'o3' }] },
    });
    expect(await job.sendFollowups(NOW)).toBe(3);
    expect(sendBoostPromotion).toHaveBeenCalledWith(['a'], { channel: 'in_app', adminId: 'admin1', skipCooldown: true });
    expect(create).toHaveBeenCalledWith({ data: { listingId: 'b', kind: 'boost_followup_1d', channel: 'in_app' } });
  });

  it('sends one message per owner per run', async () => {
    const { job, sendBoostPromotion } = makeFollowup({
      byStage: { boost_followup_4h: [{ id: 'a', ownerId: 'o1' }, { id: 'b', ownerId: 'o1' }] },
    });
    expect(await job.sendFollowups(NOW)).toBe(1);
    expect(sendBoostPromotion).toHaveBeenCalledTimes(1);
  });

  it('marks a final refusal (already featured) as done, but retries a failed send', async () => {
    const refused = makeFollowup({ byStage: { boost_followup_4h: [{ id: 'a', ownerId: 'o1' }] }, sendResult: { sent: 0, error: 'Already boosted' } });
    expect(await refused.job.sendFollowups(NOW)).toBe(0);
    expect(refused.create).toHaveBeenCalledWith({ data: { listingId: 'a', kind: 'boost_followup_4h', channel: 'skipped' } });

    const failed = makeFollowup({ byStage: { boost_followup_4h: [{ id: 'a', ownerId: 'o1' }] }, sendResult: { sent: 0, error: 'In-app message failed' } });
    expect(await failed.job.sendFollowups(NOW)).toBe(0);
    expect(failed.create).not.toHaveBeenCalled();
  });

  it('can be switched off', async () => {
    process.env.BOOST_FOLLOWUP_ENABLED = 'false';
    const { job, sendBoostPromotion } = makeFollowup({ byStage: { boost_followup_4h: [{ id: 'a', ownerId: 'o1' }] } });
    await job.run();
    expect(sendBoostPromotion).not.toHaveBeenCalled();
  });
});
