import { NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { ListingsService } from '../listings/listings.service';
import { MessagingService } from '../messaging/messaging.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RateLimitService } from '../rate-limit/rate-limit.service';

/** rotatePhoto only ever touches PrismaService — the other four constructor deps are irrelevant
 * to this method, so bare stand-ins are enough. */
function makeService(photo: { rotation: number } | null, jobCount = 2) {
  const findUnique = jest.fn().mockResolvedValue(photo);
  const update = jest.fn().mockResolvedValue(undefined);
  const updateMany = jest.fn().mockResolvedValue({ count: jobCount });
  const prisma = {
    listingPhoto: { findUnique, update },
    photoVariantJob: { updateMany },
  } as unknown as PrismaService;

  const service = new AdminService(
    prisma,
    {} as unknown as ListingsService,
    {} as unknown as MessagingService,
    {} as unknown as NotificationsService,
    {} as unknown as RateLimitService,
  );
  return { service, update };
}

describe('AdminService.rotatePhoto', () => {
  /** This is the exact math that caused real confusion: the admin UI lets an admin cycle a
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
      const { service, update } = makeService({ rotation: current });
      const result = await service.rotatePhoto('l1', 1, turns);
      expect(result).toEqual({ rotation: expected });
      expect(update).toHaveBeenCalledWith({
        where: { listingId_photoNo: { listingId: 'l1', photoNo: 1 } },
        data: { rotation: expected },
      });
    },
  );

  it('throws if the photo does not exist', async () => {
    const { service } = makeService(null);
    await expect(service.rotatePhoto('l1', 1, 1)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws if no variant jobs exist to reprocess', async () => {
    const { service } = makeService({ rotation: 0 }, 0);
    await expect(service.rotatePhoto('l1', 1, 1)).rejects.toThrow(
      NotFoundException,
    );
  });
});
