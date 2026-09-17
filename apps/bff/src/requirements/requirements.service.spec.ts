import { RequirementsService } from './requirements.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { NotificationsService } from '../notifications/notifications.service';
import type { SavedSearchesService } from '../saved-searches/saved-searches.service';

/** The behaviour worth pinning: the capture is the part that must never be lost. The alert and
 * the confirmation are both best-effort, and a failure in either has to leave the requirement
 * standing — otherwise a seeker who was told "we've noted it" ends up with nothing recorded,
 * which is the exact dead end this feature exists to remove. */
function make(options: { allowance?: { source: 'plus' | 'free'; freeRemaining: number } | null } = {}) {
  const requirementCreate = jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve({
      id: 'r1',
      searchLabel: data.searchLabel,
      category: data.category ?? null,
      transactionType: data.transactionType ?? null,
      cityId: data.cityId ?? null,
      areaId: data.areaId ?? null,
      minPrice: data.minPrice ?? null,
      maxPrice: data.maxPrice ?? null,
      bedrooms: data.bedrooms ?? null,
      landingPath: data.landingPath ?? null,
      savedSearchId: data.savedSearchId ?? null,
      contactConsentAt: data.contactConsentAt ?? null,
      note: data.note ?? null,
      moveInBy: data.moveInBy ?? null,
      status: 'open',
      closedReason: null,
      expiresAt: data.expiresAt ?? new Date(),
      createdAt: new Date(),
      city: null,
      area: null,
    }),
  );
  const requirementFindFirst = jest.fn();
  const requirementUpdate = jest.fn();
  const prisma = {
    requirement: {
      create: requirementCreate,
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: requirementFindFirst,
      update: requirementUpdate,
    },
    user: { findUnique: jest.fn().mockResolvedValue({ id: 'u1', name: 'A', email: 'a@b.c', phone: null }) },
  } as unknown as PrismaService;

  const notifyRequirementCaptured = jest.fn().mockResolvedValue('email');
  const notificationsService = { notifyRequirementCaptured } as unknown as NotificationsService;

  const savedSearchCreate = jest.fn().mockResolvedValue({ id: 'ss1' });
  const savedSearchesService = {
    alertAllowance: jest
      .fn()
      .mockResolvedValue('allowance' in options ? options.allowance : { source: 'free', freeRemaining: 2 }),
    create: savedSearchCreate,
  } as unknown as SavedSearchesService;

  return {
    service: new RequirementsService(prisma, notificationsService, savedSearchesService),
    requirementCreate,
    requirementFindFirst,
    requirementUpdate,
    savedSearchCreate,
    notifyRequirementCaptured,
    savedSearchesService,
  };
}

const dto = {
  searchLabel: '2 BHK apartments for rent in Koramangala, Bengaluru',
  category: 'apartment' as const,
  transactionType: 'rent' as const,
  cityId: 'c1',
  areaId: 'a1',
  maxPrice: 40000,
  bedrooms: 2,
  landingPath: '/bengaluru/koramangala/rent-lease/apartment',
};

describe('RequirementsService.create', () => {
  it('captures the requirement and creates the alert alongside it', async () => {
    const { service, requirementCreate, savedSearchCreate } = make();

    const result = await service.create('u1', dto);

    expect(requirementCreate.mock.calls[0][0].data).toMatchObject({
      seekerId: 'u1',
      searchLabel: dto.searchLabel,
      category: 'apartment',
      transactionType: 'rent',
      cityId: 'c1',
      areaId: 'a1',
      maxPrice: 40000,
      bedrooms: 2,
      landingPath: dto.landingPath,
      savedSearchId: 'ss1',
    });
    // The alert reuses the same criteria vocabulary, with the label as its name.
    expect(savedSearchCreate.mock.calls[0][1]).toMatchObject({ name: dto.searchLabel, category: 'apartment' });
    expect(result.hasAlert).toBe(true);
  });

  it('still captures when the seeker has no alert allowance left', async () => {
    const { service, requirementCreate, savedSearchCreate, notifyRequirementCaptured } = make({ allowance: null });

    const result = await service.create('u1', dto);

    expect(savedSearchCreate).not.toHaveBeenCalled();
    expect(requirementCreate.mock.calls[0][0].data.savedSearchId).toBeNull();
    expect(result.hasAlert).toBe(false);
    // And the confirmation must not promise an alert that will never arrive.
    expect(notifyRequirementCaptured).toHaveBeenCalledWith(expect.anything(), dto.searchLabel, false);
  });

  it('still captures when creating the alert throws', async () => {
    const { service, requirementCreate, savedSearchesService } = make();
    (savedSearchesService.create as jest.Mock).mockRejectedValueOnce(new Error('quota race'));

    const result = await service.create('u1', dto);

    expect(requirementCreate).toHaveBeenCalled();
    expect(result.hasAlert).toBe(false);
  });

  it('stamps contact consent only when the seeker actually gave it', async () => {
    const { service, requirementCreate } = make();

    const consented = await service.create('u1', { ...dto, contactConsent: true });
    expect(requirementCreate.mock.calls[0][0].data.contactConsentAt).toBeInstanceOf(Date);
    expect(consented.contactConsent).toBe(true);
  });

  it.each([{ contactConsent: false }, {}])(
    // Absence must never read as permission: a row captured before the question existed, or by a
    // client that never asks it, has not consented to anything.
    'treats %p as no consent',
    async (overrides) => {
      const { service, requirementCreate } = make();

      const result = await service.create('u1', { ...dto, ...overrides });

      expect(requirementCreate.mock.calls[0][0].data.contactConsentAt).toBeNull();
      expect(result.contactConsent).toBe(false);
    },
  );

  it('still captures when the confirmation fails to send', async () => {
    const { service, requirementCreate, notifyRequirementCaptured } = make();
    notifyRequirementCaptured.mockRejectedValueOnce(new Error('smtp down'));

    await expect(service.create('u1', dto)).resolves.toMatchObject({ id: 'r1' });
    expect(requirementCreate).toHaveBeenCalled();
  });
});

const DAY_MS = 24 * 60 * 60 * 1000;

/** Phase 1's seeker-side controls. The rule worth pinning hardest is the renewal arithmetic:
 * counting 30 days from *now* instead of from the later of now/expiry would silently shorten the
 * life of anything renewed early, which is the opposite of what pressing "renew" means. */
describe('RequirementsService — the seeker\'s own controls', () => {
  const existing = (overrides: Record<string, unknown> = {}) => ({
    id: 'r1',
    seekerId: 'u1',
    expiresAt: new Date(Date.now() + 10 * DAY_MS),
    closedReason: null,
    ...overrides,
  });
  const updated = { id: 'r1', searchLabel: 'x', expiresAt: new Date(), createdAt: new Date(), status: 'open', city: null, area: null };

  it('refuses to touch a requirement belonging to someone else', async () => {
    const { service, requirementFindFirst, requirementUpdate } = make();
    // findFirst is scoped by seekerId, so another user's row simply isn't found — the where
    // clause is the authorisation, not a filter applied afterwards.
    requirementFindFirst.mockResolvedValue(null);

    await expect(service.renewMine('someone-else', 'r1')).rejects.toThrow();
    await expect(service.closeMine('someone-else', 'r1', 'withdrawn')).rejects.toThrow();
    await expect(service.updateMine('someone-else', 'r1', { note: 'hi' })).rejects.toThrow();
    expect(requirementUpdate).not.toHaveBeenCalled();
    expect(requirementFindFirst.mock.calls[0][0].where).toMatchObject({ id: 'r1', seekerId: 'someone-else' });
  });

  it('renews from the existing expiry, so renewing early extends rather than shortens', async () => {
    const { service, requirementFindFirst, requirementUpdate } = make();
    const current = new Date(Date.now() + 10 * DAY_MS);
    requirementFindFirst.mockResolvedValue(existing({ expiresAt: current }));
    requirementUpdate.mockResolvedValue(updated);

    await service.renewMine('u1', 'r1');

    const next = requirementUpdate.mock.calls[0][0].data.expiresAt as Date;
    expect(Math.round((next.getTime() - current.getTime()) / DAY_MS)).toBe(30);
  });

  it('renews from today when it had already lapsed', async () => {
    const { service, requirementFindFirst, requirementUpdate } = make();
    requirementFindFirst.mockResolvedValue(existing({ expiresAt: new Date(Date.now() - 5 * DAY_MS) }));
    requirementUpdate.mockResolvedValue(updated);

    await service.renewMine('u1', 'r1');

    const next = requirementUpdate.mock.calls[0][0].data.expiresAt as Date;
    expect(Math.round((next.getTime() - Date.now()) / DAY_MS)).toBe(30);
  });

  it('reopens an expired requirement on renewal, and lets owners hear about it again', async () => {
    const { service, requirementFindFirst, requirementUpdate } = make();
    requirementFindFirst.mockResolvedValue(existing({ closedReason: 'expired', status: 'closed' }));
    requirementUpdate.mockResolvedValue(updated);

    await service.renewMine('u1', 'r1');

    expect(requirementUpdate.mock.calls[0][0].data).toMatchObject({ status: 'open', closedReason: null });
    // Renewed demand is fresh demand — owners who have listed since have never heard about it.
    expect(requirementUpdate.mock.calls[0][0].data.ownersNotifiedAt).toBeNull();
  });

  it('does not reopen one the seeker had deliberately withdrawn', async () => {
    const { service, requirementFindFirst, requirementUpdate } = make();
    requirementFindFirst.mockResolvedValue(existing({ closedReason: 'withdrawn', status: 'closed' }));
    requirementUpdate.mockResolvedValue(updated);

    await service.renewMine('u1', 'r1');

    expect(requirementUpdate.mock.calls[0][0].data.status).toBeUndefined();
  });

  it('keeps fulfilled and withdrawn distinct', async () => {
    const { service, requirementFindFirst, requirementUpdate } = make();
    requirementFindFirst.mockResolvedValue(existing());
    requirementUpdate.mockResolvedValue(updated);

    await service.closeMine('u1', 'r1', 'fulfilled');
    expect(requirementUpdate.mock.calls[0][0].data).toEqual({ status: 'closed', closedReason: 'fulfilled' });

    await service.closeMine('u1', 'r1', 'withdrawn');
    expect(requirementUpdate.mock.calls[1][0].data).toEqual({ status: 'closed', closedReason: 'withdrawn' });
  });

  it('lets the seeker edit only their note and timeline, never the criteria', async () => {
    const { service, requirementFindFirst, requirementUpdate } = make();
    requirementFindFirst.mockResolvedValue(existing());
    requirementUpdate.mockResolvedValue(updated);

    await service.updateMine('u1', 'r1', { note: 'ground floor please', moveInBy: '2026-12-01T00:00:00.000Z' });

    // The criteria were captured from a real search and an admin may already have worked the
    // queue against them, so they are not the seeker's to change afterwards.
    expect(Object.keys(requirementUpdate.mock.calls[0][0].data).sort()).toEqual(['moveInBy', 'note']);
  });
});
