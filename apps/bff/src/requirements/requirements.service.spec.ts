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
      status: 'open',
      createdAt: new Date(),
      city: null,
      area: null,
    }),
  );
  const prisma = {
    requirement: { create: requirementCreate, findMany: jest.fn().mockResolvedValue([]) },
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

  it('still captures when the confirmation fails to send', async () => {
    const { service, requirementCreate, notifyRequirementCaptured } = make();
    notifyRequirementCaptured.mockRejectedValueOnce(new Error('smtp down'));

    await expect(service.create('u1', dto)).resolves.toMatchObject({ id: 'r1' });
    expect(requirementCreate).toHaveBeenCalled();
  });
});
