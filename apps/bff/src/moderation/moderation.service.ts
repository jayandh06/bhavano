import { Injectable } from '@nestjs/common';
import type { CreateListingInput } from '@bhavano/types';
import { PrismaService } from '../prisma/prisma.service';
import { findBannedWord } from './bannedWords';
import { checkPriceSanity } from './priceBounds';

const DUPLICATE_HAMMING_THRESHOLD = 5;

function hammingDistanceHex(a: string, b: string): number {
  let xor = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let count = 0;
  while (xor > 0n) {
    count += Number(xor & 1n);
    xor >>= 1n;
  }
  return count;
}

export type ModerationResult =
  | { ok: true }
  | { ok: false; reason: string; duplicatePhotoNos?: number[] };

@Injectable()
export class ModerationService {
  constructor(private readonly prisma: PrismaService) {}

  async moderate(input: CreateListingInput, ownerId: string): Promise<ModerationResult> {
    const bannedInTitle = findBannedWord(input.title);
    if (bannedInTitle) {
      return { ok: false, reason: `Title contains a disallowed phrase: "${bannedInTitle}"` };
    }

    if (input.attributes) {
      for (const value of Object.values(input.attributes)) {
        if (typeof value === 'string') {
          const banned = findBannedWord(value);
          if (banned) return { ok: false, reason: `A field contains a disallowed phrase: "${banned}"` };
        }
      }
    }

    const priceIssue = checkPriceSanity(input.category, input.transactionType, input.price);
    if (priceIssue) return { ok: false, reason: priceIssue };

    if (input.photos.length) {
      const duplicatePhotoNos = await this.findDuplicatePhotoNos(input.photos, input.cityId, ownerId);
      if (duplicatePhotoNos.length) {
        return {
          ok: false,
          // Plural wording regardless of count — simpler than branching on duplicatePhotoNos.length
          // for a one-word difference, and "one of the..." reads fine even when it's naming one.
          reason: 'One of the uploaded photos appears to already be in use on another listing',
          duplicatePhotoNos,
        };
      }
    }

    return { ok: true };
  }

  /** Single-hash convenience wrapper for ListingsService.addPhoto (a post-creation add), which
   * has no full CreateListingInput to hand `moderate()` — only the listing's own cityId/ownerId,
   * and (being a single-photo add) no need for which photoNo matched, just whether it did. */
  async isDuplicatePhotoHash(hash: string, cityId: string, ownerId: string): Promise<boolean> {
    const matches = await this.findDuplicatePhotoNos([{ photoNo: 0, hash }], cityId, ownerId);
    return matches.length > 0;
  }

  /** Scoped to the same city, via the indexed Listing.cityId (see @@index([cityId, category])) —
   * this used to scan every ListingPhoto row in the whole table on every single listing create,
   * comparing each against every uploaded hash with an O(n) Hamming distance in JS. The repost
   * fraud this guards against (the same stolen photos reused across fake listings) is realistically
   * same-market, so scoping by city bounds the scan per-city as the table grows instead of letting
   * it grow unbounded with total listings nationwide.
   *
   * Excludes the posting user's own other listings: the fraud this guards against is *someone
   * else* reusing a stranger's real photos, not an owner reusing their own — without this
   * exclusion, a second listing for the same property (e.g. testing both Sale and Rent), or a
   * fresh repost after an old listing lapsed without using Renew, was wrongly blocked as if it
   * were the theft case. Confirmed live 2026-10-08: real owners were hitting this.
   *
   * Returns the matching photoNos, not just a boolean, so the client can point at exactly which
   * photo(s) to remove or replace instead of a seller guessing which of up to MAX_PHOTOS it was. */
  private async findDuplicatePhotoNos(
    photos: { photoNo: number; hash: string }[],
    cityId: string,
    ownerId: string,
  ): Promise<number[]> {
    const existing = await this.prisma.listingPhoto.findMany({
      where: { listing: { cityId, ownerId: { not: ownerId } } },
      select: { hash: true },
    });
    return photos
      .filter((p) => existing.some((row) => hammingDistanceHex(p.hash, row.hash) <= DUPLICATE_HAMMING_THRESHOLD))
      .map((p) => p.photoNo);
  }
}
