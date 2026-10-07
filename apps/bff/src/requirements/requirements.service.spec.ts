import { Prisma } from '@prisma/client';
import { RequirementsService } from './requirements.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { NotificationsService } from '../notifications/notifications.service';
import type { AnalyticsService } from '../analytics/analytics.service';
import type { SavedSearchesService } from '../saved-searches/saved-searches.service';

const DAY_MS = 24 * 60 * 60 * 1000;

const CITIES: Record<string, { id: string; name: string }> = {
  c1: { id: 'c1', name: 'Bengaluru' },
  c2: { id: 'c2', name: 'Chennai' },
};

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
      areaIds: data.areaIds ?? [],
      minPrice: data.minPrice ?? null,
      maxPrice: data.maxPrice ?? null,
      bedrooms: data.bedrooms ?? null,
      bedroomOptions: data.bedroomOptions ?? [],
      minAreaSqft: data.minAreaSqft ?? null,
      maxAreaSqft: data.maxAreaSqft ?? null,
      areaUnit: data.areaUnit ?? null,
      originalSearchLabel: data.originalSearchLabel ?? null,
      refinedAt: data.refinedAt ?? null,
      attributes: data.attributes ?? null,
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
  const savedSearchUpdate = jest.fn().mockResolvedValue({});
  // Areas a1..a9 are in city c1; anything else belongs to another city.
  const areaFindMany = jest.fn().mockImplementation(({ where }: { where: { id: { in: string[] }; cityId?: string } }) =>
    Promise.resolve(
      where.id.in
        .filter((id) => /^a\d$/.test(id) && (!where.cityId || where.cityId === 'c1'))
        .map((id) => ({ id, name: `Area ${id}` })),
    ),
  );
  const prisma = {
    requirement: {
      create: requirementCreate,
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: requirementFindFirst,
      update: requirementUpdate,
    },
    area: { findMany: areaFindMany },
    city: {
      findUnique: jest.fn().mockImplementation(({ where }: { where: { id: string } }) =>
        Promise.resolve(CITIES[where.id] ?? null),
      ),
    },
    savedSearch: { update: savedSearchUpdate },
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
    service: new RequirementsService(prisma, notificationsService, savedSearchesService, { recordPageView: jest.fn().mockResolvedValue(undefined) } as unknown as AnalyticsService),
    requirementCreate,
    requirementFindFirst,
    requirementUpdate,
    savedSearchCreate,
    savedSearchUpdate,
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

    const data = requirementCreate.mock.calls[0][0].data;
    expect(data).toMatchObject({
      seekerId: 'u1',
      originalSearchLabel: dto.searchLabel,
      category: 'apartment',
      transactionType: 'rent',
      cityId: 'c1',
      areaId: 'a1',
      maxPrice: 40000,
      bedrooms: 2,
      landingPath: dto.landingPath,
      savedSearchId: 'ss1',
    });
    // Written from the answers, like a refinement, rather than trusting the page heading.
    expect(data.searchLabel).toContain('Area a1');
    expect(data.searchLabel).toContain('Bengaluru');
    expect(data.refinedAt).toBeInstanceOf(Date);
    // The alert reuses the same criteria vocabulary, with the label as its name.
    expect(savedSearchCreate.mock.calls[0][1]).toMatchObject({ name: data.searchLabel, category: 'apartment' });
    expect(result.hasAlert).toBe(true);
    expect(result.isLeadReady).toBe(true);
  });

  it.each([
    ['an area', { areaId: undefined }, /area/],
    ['buy or rent', { transactionType: undefined }, /buying or renting/],
    ['the property type', { category: undefined }, /property type/],
  ])('refuses a requirement without %s — it is created complete or not at all', async (_gap, overrides, message) => {
    const { service, requirementCreate, savedSearchCreate } = make();

    await expect(service.create('u1', { ...dto, ...overrides })).rejects.toThrow(message);
    expect(requirementCreate).not.toHaveBeenCalled();
    expect(savedSearchCreate).not.toHaveBeenCalled();
  });

  it('refuses when every area named is outside the city', async () => {
    const { service, requirementCreate } = make();

    await expect(service.create('u1', { ...dto, areaId: undefined, areaIds: ['elsewhere'] })).rejects.toThrow(/area/);
    expect(requirementCreate).not.toHaveBeenCalled();
  });

  it('keeps a plot size, and drops a size the category does not have', async () => {
    const { service, requirementCreate } = make();

    await service.create('u1', {
      ...dto,
      category: 'plot',
      transactionType: 'buy',
      bedrooms: undefined,
      maxPrice: undefined,
      minAreaSqft: 1200,
      maxAreaSqft: 2400,
      areaUnit: 'sqft',
    });
    expect(requirementCreate.mock.calls[0][0].data).toMatchObject({ minAreaSqft: 1200, maxAreaSqft: 2400, areaUnit: 'sqft', bedroomOptions: [] });

    await service.create('u1', { ...dto, minAreaSqft: 1200, areaUnit: 'sqft' });
    expect(requirementCreate.mock.calls[1][0].data).toMatchObject({ minAreaSqft: undefined, areaUnit: undefined });
  });

  it('refuses a budget whose lowest is above its highest', async () => {
    const { service } = make();
    await expect(service.create('u1', { ...dto, minPrice: 50000, maxPrice: 40000 })).rejects.toThrow(/budget/);
  });

  it('refuses a budget below the category/transaction floor — ₹7/month for an apartment rental is never real', async () => {
    const { service } = make();
    await expect(service.create('u1', { ...dto, minPrice: undefined, maxPrice: 7 })).rejects.toThrow(/below the typical range/);
  });

  it('accepts a budget comfortably inside the floor', async () => {
    const { service, requirementCreate } = make();
    await service.create('u1', { ...dto, minPrice: 20000, maxPrice: 40000 });
    expect(requirementCreate.mock.calls[0][0].data).toMatchObject({ minPrice: 20000, maxPrice: 40000 });
  });

  it('still captures when the seeker has no alert allowance left', async () => {
    const { service, requirementCreate, savedSearchCreate, notifyRequirementCaptured } = make({ allowance: null });

    const result = await service.create('u1', dto);

    expect(savedSearchCreate).not.toHaveBeenCalled();
    expect(requirementCreate.mock.calls[0][0].data.savedSearchId).toBeNull();
    expect(result.hasAlert).toBe(false);
    // And the confirmation must not promise an alert that will never arrive.
    expect(notifyRequirementCaptured).toHaveBeenCalledWith(
      expect.anything(),
      requirementCreate.mock.calls[0][0].data.searchLabel,
      false,
    );
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

  it('keeps every area and the whole BHK set the search had, instead of collapsing them', async () => {
    const { service, requirementCreate, savedSearchCreate } = make();

    const result = await service.create('u1', {
      ...dto,
      areaId: undefined,
      bedrooms: undefined,
      areaIds: ['a1', 'a2', 'elsewhere'],
      bedroomOptions: [3, 2],
      attributes: { furnished: ['semi'], bogus: ['x'] },
    });

    // A foreign area or an unknown facet is dropped rather than failing the whole request.
    expect(requirementCreate.mock.calls[0][0].data).toMatchObject({
      areaIds: ['a1', 'a2'],
      areaId: 'a1',
      bedroomOptions: [2, 3],
      bedrooms: 2,
      attributes: { furnished: ['semi'] },
    });
    // The alert now carries the same full areaIds/bedroomOptions the requirement does (2026-09-30
    // — SavedSearch stopped narrowing to one of each once it gained its own array columns).
    expect(savedSearchCreate.mock.calls[0][1]).toMatchObject({ areaIds: ['a1', 'a2'], bedroomOptions: [2, 3] });
    expect(result.areaNames).toEqual(['Area a1', 'Area a2']);
    expect(result.isLeadReady).toBe(true);
  });

  it('refuses a capture without a real city — "anywhere in India" is not a requirement', async () => {
    const { service, requirementCreate, savedSearchCreate } = make();

    await expect(service.create('u1', { ...dto, cityId: 'nowhere' })).rejects.toThrow(/city/);
    expect(requirementCreate).not.toHaveBeenCalled();
    expect(savedSearchCreate).not.toHaveBeenCalled();
  });
});

/** The refinement questions — docs/plans/requirement-refinement-questions.md. The rules worth
 * pinning: criteria change only until someone has acted on them, every write is re-validated as
 * a whole, and the label and the alert follow the criteria. */
describe('RequirementsService.refineMine', () => {
  const row = (overrides: Record<string, unknown> = {}) => ({
    id: 'r1',
    seekerId: 'u1',
    searchLabel: 'Rent 2 BHK Houses in Bengaluru',
    originalSearchLabel: null,
    category: 'house',
    transactionType: 'rent',
    cityId: 'c1',
    areaId: null,
    areaIds: [],
    bedrooms: 2,
    bedroomOptions: [2],
    minPrice: null,
    maxPrice: null,
    minAreaSqft: null,
    maxAreaSqft: null,
    areaUnit: null,
    attributes: null,
    note: null,
    moveInBy: null,
    status: 'open',
    closedReason: null,
    adminNote: null,
    ownersNotifiedAt: null,
    refinedAt: null,
    savedSearchId: 'ss1',
    contactConsentAt: null,
    expiresAt: new Date(Date.now() + 10 * DAY_MS),
    createdAt: new Date(),
    city: { id: 'c1', name: 'Bengaluru' },
    area: null,
    ...overrides,
  });

  function setup(existing: Record<string, unknown> = {}) {
    const ctx = make();
    ctx.requirementFindFirst.mockResolvedValue(row(existing));
    ctx.requirementUpdate.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve(row({ ...existing, ...data, attributes: data.attributes && typeof data.attributes === 'object' ? data.attributes : null })),
    );
    return ctx;
  }

  it.each([
    { adminNote: 'called, sent 2 options' },
    { ownersNotifiedAt: new Date() },
    { status: 'working' },
    { expiresAt: new Date(Date.now() - DAY_MS) },
  ])('refuses once the requirement has been acted on (%p)', async (acted) => {
    const { service, requirementUpdate } = setup(acted);

    await expect(service.refineMine('u1', 'r1', { minPrice: 20000 })).rejects.toThrow(/already being worked on/);
    expect(requirementUpdate).not.toHaveBeenCalled();
  });

  it('merges a step, rewrites the label from the criteria, and keeps the original', async () => {
    const { service, requirementUpdate } = setup();

    const result = await service.refineMine('u1', 'r1', { areaIds: ['a1', 'a2'], minPrice: 25000, maxPrice: 35000 });

    const data = requirementUpdate.mock.calls[0][0].data;
    expect(data).toMatchObject({
      areaIds: ['a1', 'a2'],
      areaId: 'a1',
      bedroomOptions: [2],
      minPrice: 25000,
      maxPrice: 35000,
      originalSearchLabel: 'Rent 2 BHK Houses in Bengaluru',
      searchLabel: '2 BHK house for rent in Area a1 or Area a2, Bengaluru · ₹25k–35k/month',
    });
    // Not complete until they reach the review step.
    expect(data.refinedAt).toBeUndefined();
    expect(result.isLeadReady).toBe(true);
  });

  it('stamps refinedAt only when the seeker completes the questions', async () => {
    const { service, requirementUpdate } = setup({ areaIds: ['a1'], areaId: 'a1' });

    await service.refineMine('u1', 'r1', { complete: true });

    expect(requirementUpdate.mock.calls[0][0].data.refinedAt).toBeInstanceOf(Date);
  });

  it('refuses a budget below the category/transaction floor', async () => {
    const { service } = setup();
    await expect(service.refineMine('u1', 'r1', { maxPrice: 7 })).rejects.toThrow(/below the typical range/);
  });

  it('never re-validates a budget already stored, when this patch does not touch it', async () => {
    // A row saved before this check existed (the exact ₹7/month case this was added for) must
    // stay editable for everything else — refusing every future refine because of a value this
    // specific patch never sent would strand it.
    const { service, requirementUpdate } = setup({ minPrice: null, maxPrice: 7 });

    await expect(service.refineMine('u1', 'r1', { areaIds: ['a1'] })).resolves.toMatchObject({ id: 'r1' });
    expect(requirementUpdate.mock.calls[0][0].data).toMatchObject({ areaIds: ['a1'] });
  });

  it('says what is missing in the label when it is still vague', async () => {
    const { service, requirementUpdate } = setup({ category: null, bedroomOptions: [], bedrooms: null });

    await service.refineMine('u1', 'r1', { minPrice: 20000 });

    expect(requirementUpdate.mock.calls[0][0].data.searchLabel).toBe(
      'Property for rent in Bengaluru · ₹20k+/month — area and property type not specified',
    );
  });

  it('refuses to complete a requirement missing a city, an area, buy/rent or the property type', async () => {
    const { service, requirementUpdate } = setup({ category: null });

    await expect(service.refineMine('u1', 'r1', { complete: true })).rejects.toThrow(
      'Add at least one area and the property type first',
    );
    expect(requirementUpdate).not.toHaveBeenCalled();
  });

  it('does not need a budget or size to be complete', async () => {
    const { service, requirementUpdate } = setup({ areaIds: ['a1'], areaId: 'a1', bedroomOptions: [], bedrooms: null });

    const result = await service.refineMine('u1', 'r1', { complete: true });

    expect(requirementUpdate.mock.calls[0][0].data.searchLabel).toBe('House for rent in Area a1, Bengaluru');
    expect(result.isLeadReady).toBe(true);
  });

  it('refuses areas outside the requirement’s city', async () => {
    const { service, requirementUpdate } = setup();

    await expect(service.refineMine('u1', 'r1', { areaIds: ['a1', 'elsewhere'] })).rejects.toThrow(/city/);
    expect(requirementUpdate).not.toHaveBeenCalled();
  });

  it('gives a row saved without a city one, and writes it into the label', async () => {
    const { service, requirementUpdate } = setup({ cityId: null, city: null });

    await service.refineMine('u1', 'r1', { cityId: 'c2' });

    const data = requirementUpdate.mock.calls[0][0].data;
    expect(data.cityId).toBe('c2');
    expect(data.searchLabel).toBe('2 BHK house for rent in Chennai — area not specified');
  });

  it('drops the old areas when the city changes, unless new ones come with it', async () => {
    const { service, requirementUpdate } = setup({ areaIds: ['a1'], areaId: 'a1' });

    await service.refineMine('u1', 'r1', { cityId: 'c2' });
    expect(requirementUpdate.mock.calls[0][0].data).toMatchObject({ cityId: 'c2', areaIds: [], areaId: null });
  });

  it('refuses a city that does not exist', async () => {
    const { service, requirementUpdate } = setup({ cityId: null, city: null });

    await expect(service.refineMine('u1', 'r1', { cityId: 'nowhere' })).rejects.toThrow(/city/);
    expect(requirementUpdate).not.toHaveBeenCalled();
  });

  it('refuses a transaction the category cannot have', async () => {
    const { service } = setup();

    await expect(service.refineMine('u1', 'r1', { category: 'plot' })).rejects.toThrow(/plot/);
  });

  it('refuses facets the category never declares', async () => {
    const { service } = setup();

    await expect(service.refineMine('u1', 'r1', { attributes: { sharingType: ['double'] } })).rejects.toThrow(/sharingType/);
  });

  it('clears what the new category cannot have when the category changes', async () => {
    const { service, requirementUpdate } = setup({ attributes: { furnished: ['semi'], preferredTenantTypes: ['family'] } });

    await service.refineMine('u1', 'r1', { category: 'plot', transactionType: 'sell' });

    const data = requirementUpdate.mock.calls[0][0].data;
    expect(data.bedroomOptions).toEqual([]);
    expect(data.bedrooms).toBeNull();
    // Stale facets are dropped quietly — only what this request sent can be "wrong".
    expect(data.attributes).toBe(Prisma.DbNull);
  });

  it('brings the paired alert along with the full areaIds/bedroomOptions, not narrowed to one of each', async () => {
    const { service, savedSearchUpdate } = setup();

    await service.refineMine('u1', 'r1', { areaIds: ['a1', 'a2'], maxPrice: 30000 });

    expect(savedSearchUpdate.mock.calls[0][0]).toMatchObject({
      where: { id: 'ss1' },
      data: { areaIds: ['a1', 'a2'], maxPrice: 30000, bedroomOptions: [2], category: 'house', transactionType: 'rent' },
    });
  });

  it('still saves the refinement when the alert cannot follow', async () => {
    const { service, savedSearchUpdate } = setup();
    savedSearchUpdate.mockRejectedValueOnce(new Error('gone'));

    await expect(service.refineMine('u1', 'r1', { maxPrice: 30000 })).resolves.toMatchObject({ id: 'r1' });
  });
});

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
  const updated = {
    id: 'r1',
    searchLabel: 'x',
    expiresAt: new Date(),
    createdAt: new Date(),
    status: 'open',
    areaIds: [],
    bedroomOptions: [],
    city: null,
    area: null,
  };

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
