import { RequirementMatchJob } from './requirement-match.job';
import type { PrismaService } from '../prisma/prisma.service';
import type { NotificationsService } from '../notifications/notifications.service';

/** Every assertion here is an anti-spam rule. This job emails people who did not ask to hear
 * from us, so the failure mode is not a bug report — it is the sender reputation that the
 * welcome emails, claim verifications and expiry reminders all depend on. */
function make(options: { pending?: Record<string, unknown>[]; listings?: Record<string, unknown>[] } = {}) {
  const requirementUpdateMany = jest.fn().mockResolvedValue({ count: 0 });
  const listingFindMany = jest.fn().mockResolvedValue(options.listings ?? [{ ownerId: 'owner1' }, { ownerId: 'owner2' }]);
  const prisma = {
    requirement: {
      findMany: jest.fn().mockResolvedValue(options.pending ?? []),
      updateMany: requirementUpdateMany,
    },
    listing: { findMany: listingFindMany },
    user: {
      findMany: jest.fn().mockImplementation(({ where }: { where: { id: { in: string[] } } }) =>
        Promise.resolve(where.id.in.map((id) => ({ id, name: id, email: `${id}@b.c`, phone: null }))),
      ),
    },
  } as unknown as PrismaService;

  const notifyRequirementsToOwner = jest.fn().mockResolvedValue('email');
  const notifications = { notifyRequirementsToOwner } as unknown as NotificationsService;

  return {
    job: new RequirementMatchJob(prisma, notifications),
    prisma,
    listingFindMany,
    requirementUpdateMany,
    notifyRequirementsToOwner,
  };
}

const requirement = (overrides: Record<string, unknown> = {}) => ({
  id: 'r1',
  seekerId: 'seeker1',
  searchLabel: '2 BHK apartment for rent in Koramangala, Bengaluru',
  cityId: 'c1',
  areaId: 'a1',
  category: 'apartment',
  maxPrice: 40000,
  moveInBy: null,
  city: { name: 'Bengaluru' },
  area: { name: 'Koramangala' },
  ...overrides,
});

describe('RequirementMatchJob', () => {
  it('matches owners on inventory — same city, area and category, never the seeker', async () => {
    const { job, listingFindMany } = make({ pending: [requirement()] });

    await job.runDaily();

    // The rule that matters most: someone who lists PGs in Bengaluru must never hear about a
    // commercial plot in Agra.
    expect(listingFindMany.mock.calls[0][0].where).toMatchObject({
      cityId: 'c1',
      areaId: 'a1',
      category: 'apartment',
      ownerId: { not: 'seeker1' },
    });
    // Capped, so one capture cannot notify everyone who ever listed in a big city.
    expect(listingFindMany.mock.calls[0][0].take).toBe(20);
  });

  it('drops the area constraint for a city-wide requirement but keeps the city', async () => {
    const { job, listingFindMany } = make({ pending: [requirement({ areaId: null })] });

    await job.runDaily();

    const where = listingFindMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(where.cityId).toBe('c1');
    expect(where).not.toHaveProperty('areaId');
  });

  it('sends one digested message per owner, not one per requirement', async () => {
    const { job, notifyRequirementsToOwner } = make({
      pending: [requirement({ id: 'r1' }), requirement({ id: 'r2', searchLabel: '3 BHK in Koramangala' })],
    });

    await job.runDaily();

    // Two requirements, two matching owners: two emails listing two things each — not four.
    expect(notifyRequirementsToOwner).toHaveBeenCalledTimes(2);
    expect(notifyRequirementsToOwner.mock.calls[0][1]).toHaveLength(2);
  });

  it('carries no seeker identity into the message', async () => {
    const { job, notifyRequirementsToOwner } = make({ pending: [requirement()] });

    await job.runDaily();

    const lines = notifyRequirementsToOwner.mock.calls[0][1] as string[];
    expect(lines.join(" ")).not.toContain('seeker1');
    expect(lines[0]).toContain('Koramangala');
  });

  it('stamps ownersNotifiedAt so the same owners are never told twice', async () => {
    const { job, requirementUpdateMany } = make({ pending: [requirement()] });

    await job.runDaily();

    const stamp = requirementUpdateMany.mock.calls.find(
      ([args]) => (args as { data: Record<string, unknown> }).data.ownersNotifiedAt instanceof Date,
    );
    expect(stamp).toBeDefined();
    expect((stamp?.[0] as { where: { id: { in: string[] } } }).where.id.in).toEqual(['r1']);
  });

  it('leaves a requirement un-stamped when nobody matched, so a later listing can still pick it up', async () => {
    const { job, requirementUpdateMany, notifyRequirementsToOwner } = make({
      pending: [requirement()],
      listings: [],
    });

    await job.runDaily();

    expect(notifyRequirementsToOwner).not.toHaveBeenCalled();
    const stamped = requirementUpdateMany.mock.calls.some(
      ([args]) => (args as { data: Record<string, unknown> }).data.ownersNotifiedAt instanceof Date,
    );
    expect(stamped).toBe(false);
  });

  it('only considers live, un-notified, recent requirements', async () => {
    const { job, prisma } = make({ pending: [] });

    await job.runDaily();

    const where = (prisma.requirement.findMany as jest.Mock).mock.calls[0][0].where as Record<string, unknown>;
    expect(where).toMatchObject({ ownersNotifiedAt: null, status: { in: ['open', 'working'] } });
    // A backlog surfacing weeks late reads as spam, not as a lead.
    expect(where.createdAt).toBeDefined();
  });

  it('retires expired requirements before notifying anyone about them', async () => {
    const { job, requirementUpdateMany } = make({ pending: [] });

    await job.runDaily();

    expect(requirementUpdateMany.mock.calls[0][0]).toMatchObject({
      where: { status: { in: ['open', 'working'] }, expiresAt: { lte: expect.any(Date) } },
      data: { status: 'closed', closedReason: 'expired' },
    });
  });

  it('still stamps after a partial send failure rather than re-notifying everyone', async () => {
    const { job, notifyRequirementsToOwner, requirementUpdateMany } = make({ pending: [requirement()] });
    notifyRequirementsToOwner.mockRejectedValueOnce(new Error('smtp down'));

    await expect(job.runDaily()).resolves.toBeUndefined();

    // A duplicate is worse than a miss here: the owners who did receive it would get it again.
    const stamped = requirementUpdateMany.mock.calls.some(
      ([args]) => (args as { data: Record<string, unknown> }).data.ownersNotifiedAt instanceof Date,
    );
    expect(stamped).toBe(true);
  });
});
