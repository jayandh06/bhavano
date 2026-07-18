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

export type ModerationResult = { ok: true } | { ok: false; reason: string };

@Injectable()
export class ModerationService {
  constructor(private readonly prisma: PrismaService) {}

  async moderate(input: CreateListingInput): Promise<ModerationResult> {
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
      const isDuplicate = await this.hasDuplicatePhoto(input.photos.map((p) => p.hash));
      if (isDuplicate) {
        return { ok: false, reason: 'One of the uploaded photos appears to already be in use on another listing' };
      }
    }

    return { ok: true };
  }

  /** Scans against all existing photo hashes — fine at current data volume; if the
   * ListingPhoto table grows large, scope this by city/category first. */
  private async hasDuplicatePhoto(hashes: string[]): Promise<boolean> {
    const existing = await this.prisma.listingPhoto.findMany({ select: { hash: true } });
    return hashes.some((newHash) => existing.some((row) => hammingDistanceHex(newHash, row.hash) <= DUPLICATE_HAMMING_THRESHOLD));
  }
}
