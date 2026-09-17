import { RequirementDigestJob } from './requirement-digest.job';
import type { PrismaService } from '../prisma/prisma.service';
import type { NotificationsService } from '../notifications/notifications.service';

/** Both of this job's failure modes are silent, which is why they are worth a test: a wrong date
 * window means it never sends and nobody notices, and an admin with no email means the same. The
 * queue going unread is the one thing that breaks Phase 0's promise to the seeker. */
function make(options: { fresh?: Record<string, unknown>[]; admins?: Record<string, unknown>[]; openTotal?: number } = {}) {
  const prisma = {
    requirement: {
      findMany: jest.fn().mockResolvedValue(options.fresh ?? []),
      count: jest.fn().mockResolvedValue(options.openTotal ?? 0),
    },
    user: {
      findMany: jest
        .fn()
        .mockResolvedValue(options.admins ?? [{ id: 'a1', name: 'Admin', email: 'a@b.c', phone: '9999999999' }]),
    },
  } as unknown as PrismaService;

  const notifyRequirementDigest = jest.fn().mockResolvedValue('email');
  const notifications = { notifyRequirementDigest } as unknown as NotificationsService;

  return { job: new RequirementDigestJob(prisma, notifications), prisma, notifyRequirementDigest };
}

const row = (overrides: Record<string, unknown> = {}) => ({
  searchLabel: '2 BHK apartments for rent in Koramangala, Bengaluru',
  savedSearchId: 'ss1',
  city: { name: 'Bengaluru' },
  area: { name: 'Koramangala' },
  seeker: { name: 'Asha', phone: '9000000000' },
  ...overrides,
});

describe('RequirementDigestJob', () => {
  it('sends the day&apos;s captures to every admin with an email', async () => {
    const { job, notifyRequirementDigest } = make({ fresh: [row()], openTotal: 4 });

    await job.runDaily();

    expect(notifyRequirementDigest).toHaveBeenCalledTimes(1);
    const [, lines, openTotal] = notifyRequirementDigest.mock.calls[0];
    expect(lines).toEqual(['2 BHK apartments for rent in Koramangala, Bengaluru — Koramangala, for Asha']);
    // The unfiltered open count, not just today's — it answers "is anyone working this queue?".
    expect(openTotal).toBe(4);
  });

  it('flags a capture that has no alert, since nothing else will reach that seeker', async () => {
    const { job, notifyRequirementDigest } = make({ fresh: [row({ savedSearchId: null })] });

    await job.runDaily();

    expect(notifyRequirementDigest.mock.calls[0][1][0]).toContain('[no alert — manual only]');
  });

  it('stays silent when nothing new came in', async () => {
    const { job, notifyRequirementDigest } = make({ fresh: [], openTotal: 3 });

    await job.runDaily();

    // A digest that arrives every day regardless is one people stop opening.
    expect(notifyRequirementDigest).not.toHaveBeenCalled();
  });

  it('queries only the last 24 hours', async () => {
    const { job, prisma } = make({ fresh: [row()] });

    await job.runDaily();

    const where = (prisma.requirement.findMany as jest.Mock).mock.calls[0][0].where as {
      createdAt: { gte: Date };
    };
    const hoursAgo = (Date.now() - where.createdAt.gte.getTime()) / 3_600_000;
    expect(hoursAgo).toBeGreaterThan(23.9);
    expect(hoursAgo).toBeLessThan(24.1);
  });

  it('does not throw when no admin has an email', async () => {
    const { job, notifyRequirementDigest } = make({ fresh: [row()], admins: [] });

    await expect(job.runDaily()).resolves.toBeUndefined();
    expect(notifyRequirementDigest).not.toHaveBeenCalled();
  });

  it('survives a send failure rather than losing the rest of the run', async () => {
    const { job, notifyRequirementDigest } = make({
      fresh: [row()],
      admins: [
        { id: 'a1', name: 'One', email: 'one@b.c', phone: null },
        { id: 'a2', name: 'Two', email: 'two@b.c', phone: null },
      ],
    });
    notifyRequirementDigest.mockRejectedValueOnce(new Error('smtp down'));

    await expect(job.runDaily()).resolves.toBeUndefined();
    expect(notifyRequirementDigest).toHaveBeenCalledTimes(2);
  });
});
