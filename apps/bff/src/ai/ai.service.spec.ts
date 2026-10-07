import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AiService } from './ai.service';
import { PrismaService } from '../prisma/prisma.service';
import type { ListingCopyLlmProvider } from './providers/listing-copy-llm.provider';
import type { NearbyLandmarksProvider } from './providers/nearby-landmarks.provider';
import type { GenerateListingCopyDto } from './dto/generate-listing-copy.dto';

function makeListing(overrides: Record<string, unknown> = {}) {
  return {
    id: 'listing1',
    ownerId: 'owner1',
    category: 'apartment',
    transactionType: 'rent',
    price: 20000,
    priceQualifier: '',
    attributes: { bedrooms: 2 },
    lat: 12.9,
    lng: 77.6,
    boostedUntil: null,
    city: { name: 'Bengaluru' },
    area: { name: 'Koramangala' },
    ...overrides,
  };
}

function makeService(opts: {
  listing?: ReturnType<typeof makeListing> | null;
  landmarks?: string[];
  landmarksError?: Error;
} = {}) {
  const prisma = {
    listing: {
      findUnique: jest.fn().mockResolvedValue(opts.listing === undefined ? makeListing() : opts.listing),
    },
  } as unknown as PrismaService;

  const llm: ListingCopyLlmProvider = {
    generateTitle: jest.fn().mockResolvedValue('A nice title'),
    generateDescription: jest.fn().mockResolvedValue({ text: 'A nice description' }),
  };

  const landmarks: NearbyLandmarksProvider = {
    findNearby: opts.landmarksError
      ? jest.fn().mockRejectedValue(opts.landmarksError)
      : jest.fn().mockResolvedValue(opts.landmarks ?? ['Some Mall']),
  };

  const service = new AiService(prisma, llm, landmarks);
  return { service, prisma, llm, landmarks };
}

describe('AiService.generate', () => {
  it('always resolves free tier when no listingId is given, regardless of any hint', async () => {
    const { service } = makeService();
    const dto: GenerateListingCopyDto = {
      fields: ['description'],
      category: 'apartment',
      transactionType: 'rent',
      cityName: 'Bengaluru',
      lat: 12.9,
      lng: 77.6,
    } as GenerateListingCopyDto;

    const result = await service.generate(dto, 'owner1');

    expect(result.tierUsed).toBe('free');
  });

  it('rejects a no-listingId request missing category/transactionType', async () => {
    const { service } = makeService();
    const dto = { fields: ['title'] } as GenerateListingCopyDto;

    await expect(service.generate(dto, 'owner1')).rejects.toThrow(BadRequestException);
  });

  it('resolves featured tier from a real boosted listing, ignoring any client-supplied fields', async () => {
    const boosted = makeListing({ boostedUntil: new Date(Date.now() + 86_400_000) });
    const { service } = makeService({ listing: boosted });
    const dto: GenerateListingCopyDto = {
      listingId: 'listing1',
      fields: ['description'],
      // Even if a client tried to claim a different category, the DB row wins.
      category: 'villa',
    } as GenerateListingCopyDto;

    const result = await service.generate(dto, 'owner1');

    expect(result.tierUsed).toBe('featured');
  });

  it('resolves free tier for a listingId request whose boost has lapsed', async () => {
    const expired = makeListing({ boostedUntil: new Date(Date.now() - 86_400_000) });
    const { service } = makeService({ listing: expired });

    const result = await service.generate({ listingId: 'listing1', fields: ['title'] } as GenerateListingCopyDto, 'owner1');

    expect(result.tierUsed).toBe('free');
  });

  it('throws NotFoundException for an unknown listingId', async () => {
    const { service } = makeService({ listing: null });

    await expect(
      service.generate({ listingId: 'ghost', fields: ['title'] } as GenerateListingCopyDto, 'owner1'),
    ).rejects.toThrow(NotFoundException);
  });

  it("throws ForbiddenException when the caller doesn't own the listing", async () => {
    const { service } = makeService({ listing: makeListing({ ownerId: 'someone-else' }) });

    await expect(
      service.generate({ listingId: 'listing1', fields: ['title'] } as GenerateListingCopyDto, 'owner1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('never calls the landmarks provider on the free tier', async () => {
    const { service, landmarks } = makeService();
    const dto: GenerateListingCopyDto = {
      fields: ['description'],
      category: 'apartment',
      transactionType: 'rent',
      lat: 12.9,
      lng: 77.6,
    } as GenerateListingCopyDto;

    const result = await service.generate(dto, 'owner1');

    expect(landmarks.findNearby).not.toHaveBeenCalled();
    expect(result.landmarksUsed).toEqual([]);
  });

  it('never calls the landmarks provider on the featured tier when lat/lng is missing', async () => {
    const boosted = makeListing({ boostedUntil: new Date(Date.now() + 86_400_000), lat: null, lng: null });
    const { service, landmarks } = makeService({ listing: boosted });

    const result = await service.generate({ listingId: 'listing1', fields: ['description'] } as GenerateListingCopyDto, 'owner1');

    expect(landmarks.findNearby).not.toHaveBeenCalled();
    expect(result.landmarksUsed).toEqual([]);
  });

  it('calls the landmarks provider on the featured tier with lat/lng, and narrates only what it returns', async () => {
    const boosted = makeListing({ boostedUntil: new Date(Date.now() + 86_400_000) });
    const { service, landmarks, llm } = makeService({ listing: boosted, landmarks: ['Lulu Mall', 'St. Mary School'] });

    const result = await service.generate({ listingId: 'listing1', fields: ['description'] } as GenerateListingCopyDto, 'owner1');

    expect(landmarks.findNearby).toHaveBeenCalledWith(12.9, 77.6);
    expect(result.landmarksUsed).toEqual(['Lulu Mall', 'St. Mary School']);
    expect(llm.generateDescription).toHaveBeenCalledWith(
      expect.objectContaining({ tier: 'featured', landmarks: ['Lulu Mall', 'St. Mary School'] }),
    );
  });

  it('still returns a description with an empty landmarks list when the Places lookup fails', async () => {
    const boosted = makeListing({ boostedUntil: new Date(Date.now() + 86_400_000) });
    const { service } = makeService({ listing: boosted, landmarksError: new Error('Places unavailable') });

    const result = await service.generate({ listingId: 'listing1', fields: ['description'] } as GenerateListingCopyDto, 'owner1');

    expect(result.description).toBe('A nice description');
    expect(result.landmarksUsed).toEqual([]);
  });

  it('only generates the fields actually requested', async () => {
    const { service, llm } = makeService();

    const result = await service.generate(
      { fields: ['title'], category: 'apartment', transactionType: 'rent' } as GenerateListingCopyDto,
      'owner1',
    );

    expect(result.title).toBe('A nice title');
    expect(result.description).toBeUndefined();
    expect(llm.generateDescription).not.toHaveBeenCalled();
  });
});
