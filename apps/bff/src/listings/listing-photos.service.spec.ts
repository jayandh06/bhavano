import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ListingPhotosService } from './listing-photos.service';
import { PrismaService } from '../prisma/prisma.service';

function makeService(opts: {
  photo?: { rotation: number } | null;
  jobCount?: number;
  photos?: { photoNo: number; displayOrder: number }[];
  ownerId?: string;
}) {
  const findUniqueListingPhoto = jest
    .fn()
    .mockResolvedValue(opts.photo ?? null);
  const update = jest.fn().mockResolvedValue(undefined);
  const updateMany = jest.fn().mockResolvedValue({ count: opts.jobCount ?? 2 });
  const findMany = jest.fn().mockResolvedValue(opts.photos ?? []);
  const findUniqueListing = jest
    .fn()
    .mockResolvedValue(
      opts.ownerId !== undefined ? { ownerId: opts.ownerId } : null,
    );

  const prisma = {
    listingPhoto: { findUnique: findUniqueListingPhoto, update, findMany },
    photoVariantJob: { updateMany },
    listing: { findUnique: findUniqueListing },
  } as unknown as PrismaService;

  const service = new ListingPhotosService(prisma);
  return { service, update, findUniqueListing };
}

describe('ListingPhotosService.rotate', () => {
  /** This is the exact math that caused real confusion: the admin/owner UI lets someone cycle a
   * *local, unsaved* preview through several 90° turns before saving once — see
   * docs/plans/listing-photo-orientation.md. Getting `turns` wrong here would silently save the
   * wrong final orientation despite the preview showing the right one. */
  it.each([
    [0, 1, 90],
    [0, 3, 270],
    [90, 1, 180],
    [180, 2, 0],
    [270, 3, 180],
    [270, 1, 0],
  ])(
    'current rotation %d + %d turn(s) -> %d',
    async (current, turns, expected) => {
      const { service, update } = makeService({ photo: { rotation: current } });
      const result = await service.rotateAsAdmin('l1', 1, turns);
      expect(result).toEqual({ rotation: expected });
      expect(update).toHaveBeenCalledWith({
        where: { listingId_photoNo: { listingId: 'l1', photoNo: 1 } },
        data: { rotation: expected },
      });
    },
  );

  it('throws if the photo does not exist', async () => {
    const { service } = makeService({ photo: null });
    await expect(service.rotateAsAdmin('l1', 1, 1)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws if no variant jobs exist to reprocess', async () => {
    const { service } = makeService({ photo: { rotation: 0 }, jobCount: 0 });
    await expect(service.rotateAsAdmin('l1', 1, 1)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('rotateAsOwner checks ownership before rotating', async () => {
    const { service } = makeService({
      photo: { rotation: 0 },
      ownerId: 'someone-else',
    });
    await expect(service.rotateAsOwner('l1', 1, 1, 'me')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('rotateAsOwner succeeds for the actual owner', async () => {
    const { service } = makeService({ photo: { rotation: 0 }, ownerId: 'me' });
    await expect(service.rotateAsOwner('l1', 1, 1, 'me')).resolves.toEqual({
      rotation: 90,
    });
  });
});

describe('ListingPhotosService.setCover', () => {
  it('gives the target photo a displayOrder lower than every other photo', async () => {
    const { service, update } = makeService({
      photos: [
        { photoNo: 1, displayOrder: 1 },
        { photoNo: 2, displayOrder: 2 },
        { photoNo: 3, displayOrder: 3 },
      ],
    });
    const result = await service.setCoverAsAdmin('l1', 3);
    expect(result).toEqual({ displayOrder: 0 });
    expect(update).toHaveBeenCalledWith({
      where: { listingId_photoNo: { listingId: 'l1', photoNo: 3 } },
      data: { displayOrder: 0 },
    });
  });

  it('never touches photoNo, only displayOrder', async () => {
    const { service, update } = makeService({
      photos: [
        { photoNo: 1, displayOrder: 1 },
        { photoNo: 5, displayOrder: 2 },
      ],
    });
    await service.setCoverAsAdmin('l1', 5);
    const call = update.mock.calls[0] as [{ data: Record<string, unknown> }];
    expect(call[0].data).toEqual({ displayOrder: 0 });
    expect(call[0].data.photoNo).toBeUndefined();
  });

  it('is a no-op if the photo is already the cover', async () => {
    const { service, update } = makeService({
      photos: [
        { photoNo: 1, displayOrder: 0 },
        { photoNo: 2, displayOrder: 5 },
      ],
    });
    const result = await service.setCoverAsAdmin('l1', 1);
    expect(result).toEqual({ displayOrder: 0 });
    expect(update).not.toHaveBeenCalled();
  });

  it('throws if the photo does not exist', async () => {
    const { service } = makeService({
      photos: [{ photoNo: 1, displayOrder: 1 }],
    });
    await expect(service.setCoverAsAdmin('l1', 9)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('setCoverAsOwner checks ownership first', async () => {
    const { service } = makeService({
      photos: [{ photoNo: 1, displayOrder: 1 }],
      ownerId: 'someone-else',
    });
    await expect(service.setCoverAsOwner('l1', 1, 'me')).rejects.toThrow(
      ForbiddenException,
    );
  });
});
