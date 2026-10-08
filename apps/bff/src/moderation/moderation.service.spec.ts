import { ModerationService } from './moderation.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateListingInput } from '@bhavano/types';

function makeService(existingPhotoHashes: string[] = []) {
  const prisma = {
    listingPhoto: {
      findMany: jest.fn().mockResolvedValue(existingPhotoHashes.map((hash) => ({ hash }))),
    },
  } as unknown as PrismaService;

  const service = new ModerationService(prisma);
  return { service, prisma };
}

function makeInput(overrides: Partial<CreateListingInput> = {}): CreateListingInput {
  return {
    id: 'listing1',
    category: 'apartment',
    transactionType: 'rent',
    title: 'A nice place',
    cityId: 'city1',
    areaName: 'Some Area',
    price: 20000,
    photos: [{ photoNo: 1, hash: 'ff00ff00ff00ff00', ext: 'jpg' }],
    ...overrides,
  } as CreateListingInput;
}

describe('ModerationService.moderate — duplicate photos', () => {
  it('passes when no existing photo is close to the uploaded hash', async () => {
    const { service } = makeService(['0000000000000000']);

    const result = await service.moderate(makeInput(), 'owner1');

    expect(result.ok).toBe(true);
  });

  it('flags a photo whose hash is within the Hamming threshold of an existing one', async () => {
    const { service } = makeService(['ff00ff00ff00ff00']);

    const result = await service.moderate(makeInput(), 'owner1');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/already be in use on another listing/);
      expect(result.duplicatePhotoNos).toEqual([1]);
    }
  });

  it('excludes the posting user\'s own other listings from the duplicate check', async () => {
    const { service, prisma } = makeService(['ff00ff00ff00ff00']);

    await service.moderate(makeInput(), 'owner1');

    expect(prisma.listingPhoto.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { listing: { cityId: 'city1', ownerId: { not: 'owner1' } } },
      }),
    );
  });

  it('reports only the photoNos that actually matched, not every uploaded photo', async () => {
    const { service } = makeService(['ff00ff00ff00ff00']);
    const input = makeInput({
      photos: [
        { photoNo: 1, hash: 'ff00ff00ff00ff00', ext: 'jpg' },
        { photoNo: 2, hash: '0000000000000000', ext: 'jpg' },
      ],
    });

    const result = await service.moderate(input, 'owner1');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.duplicatePhotoNos).toEqual([1]);
  });
});

describe('ModerationService.isDuplicatePhotoHash', () => {
  it('excludes the given owner\'s own listings, same as moderate()', async () => {
    const { service, prisma } = makeService(['ff00ff00ff00ff00']);

    const isDuplicate = await service.isDuplicatePhotoHash('ff00ff00ff00ff00', 'city1', 'owner1');

    expect(isDuplicate).toBe(true);
    expect(prisma.listingPhoto.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { listing: { cityId: 'city1', ownerId: { not: 'owner1' } } },
      }),
    );
  });

  it('returns false when nothing matches', async () => {
    const { service } = makeService(['0000000000000000']);

    const isDuplicate = await service.isDuplicatePhotoHash('ff00ff00ff00ff00', 'city1', 'owner1');

    expect(isDuplicate).toBe(false);
  });
});
