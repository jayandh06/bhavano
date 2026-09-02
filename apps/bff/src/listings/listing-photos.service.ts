import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Rotate and reorder (cover-photo) operations on a listing's photos — shared by the admin
 * moderation page (no ownership check, an admin can act on any listing) and the listing owner's
 * own edit page (ownership enforced). See docs/plans/listing-photo-orientation.md and
 * docs/plans/listing-photo-cover-and-owner-controls.md.
 *
 * Split into `*AsAdmin`/`*AsOwner` public methods around one private core rather than a single
 * method with an optional "skip the check" flag — a flag like that is exactly the kind of thing
 * that's trivial to pass wrong (or forget) at a call site and would fail silently open, letting
 * anyone rotate/reorder any listing's photos. Two distinctly-named methods make the two call
 * sites (AdminController vs ListingsController) say outright which guarantee they're relying on.
 */
@Injectable()
export class ListingPhotosService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertOwnership(
    listingId: string,
    userId: string,
  ): Promise<void> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { ownerId: true },
    });
    if (!listing) throw new NotFoundException(`Listing ${listingId} not found`);
    if (listing.ownerId !== userId)
      throw new ForbiddenException("You don't own this listing");
  }

  /** Rotates a listing photo `turns` × 90° clockwise (1-3) and reprocesses its variants once —
   * see docs/plans/listing-photo-orientation.md for the full account of why this takes a turn
   * count instead of always advancing by one (a client-side local preview, saved once) and why
   * the completion writes in PhotoProcessingService are guarded against a stale mid-flight run. */
  private async rotate(
    listingId: string,
    photoNo: number,
    turns: number,
  ): Promise<{ rotation: number }> {
    const photo = await this.prisma.listingPhoto.findUnique({
      where: { listingId_photoNo: { listingId, photoNo } },
    });
    if (!photo)
      throw new NotFoundException(
        `Photo ${photoNo} not found on listing ${listingId}`,
      );

    const rotation = (photo.rotation + 90 * turns) % 360;
    await this.prisma.listingPhoto.update({
      where: { listingId_photoNo: { listingId, photoNo } },
      data: { rotation },
    });

    // Resets the *existing* PhotoVariantJob rows to pending rather than creating new ones: those
    // rows already know the original's file extension (PhotoVariantJob.ext), which ListingPhoto
    // itself never stores. Their absence means this photo was never actually processed, which
    // shouldn't be possible for a photo visible to whoever is calling this.
    const { count } = await this.prisma.photoVariantJob.updateMany({
      where: { listingId, photoNo },
      data: { status: 'pending', attempts: 0, error: null },
    });
    if (count === 0) {
      throw new NotFoundException(
        `No variant jobs found for photo ${photoNo} on listing ${listingId} — cannot reprocess`,
      );
    }

    return { rotation };
  }

  async rotateAsAdmin(
    listingId: string,
    photoNo: number,
    turns: number,
  ): Promise<{ rotation: number }> {
    return this.rotate(listingId, photoNo, turns);
  }

  async rotateAsOwner(
    listingId: string,
    photoNo: number,
    turns: number,
    userId: string,
  ): Promise<{ rotation: number }> {
    await this.assertOwnership(listingId, userId);
    return this.rotate(listingId, photoNo, turns);
  }

  /** Makes a photo the cover (the one shown first on browse cards and at the top of the detail
   * gallery) by giving it a `displayOrder` lower than every other photo on the listing —
   * deliberately never touches `photoNo`, which is baked into this photo's storage keys (see
   * apps/bff/src/uploads/photo-keys.ts) and would desync the DB's idea of "which photo is at
   * position 1" from which R2 objects actually hold that photo's bytes if swapped instead. No
   * reprocessing needed: displayOrder is a pure ordering hint, nothing about the photo's own
   * content or files changes. */
  private async setCover(
    listingId: string,
    photoNo: number,
  ): Promise<{ displayOrder: number }> {
    const photos = await this.prisma.listingPhoto.findMany({
      where: { listingId },
      select: { photoNo: true, displayOrder: true },
    });
    const target = photos.find((p) => p.photoNo === photoNo);
    if (!target)
      throw new NotFoundException(
        `Photo ${photoNo} not found on listing ${listingId}`,
      );

    const minOrder = Math.min(...photos.map((p) => p.displayOrder));
    if (target.displayOrder === minOrder)
      return { displayOrder: target.displayOrder }; // already the cover

    const displayOrder = minOrder - 1;
    await this.prisma.listingPhoto.update({
      where: { listingId_photoNo: { listingId, photoNo } },
      data: { displayOrder },
    });
    return { displayOrder };
  }

  async setCoverAsAdmin(
    listingId: string,
    photoNo: number,
  ): Promise<{ displayOrder: number }> {
    return this.setCover(listingId, photoNo);
  }

  async setCoverAsOwner(
    listingId: string,
    photoNo: number,
    userId: string,
  ): Promise<{ displayOrder: number }> {
    await this.assertOwnership(listingId, userId);
    return this.setCover(listingId, photoNo);
  }
}
