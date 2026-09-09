import { HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import type { ContactRevealBalanceDto, ContactRevealSettingsDto, RevealContactResponseDto } from '@bhavano/types';
import { PrismaService } from '../prisma/prisma.service';
import { CONTACT_REVEAL_SETTINGS_ID, DEFAULT_CONTACT_REVEAL_SETTINGS } from './contact-reveal.constants';

/** 402 — a status the frontend can key off reliably (not a message string) to know it should
 * open the credit-purchase sheet rather than show a plain error banner. */
export class InsufficientContactRevealCreditsException extends HttpException {
  constructor() {
    super('Insufficient contact reveal credits', HttpStatus.PAYMENT_REQUIRED);
  }
}

export type ContactRevealState = {
  contactRevealed: boolean;
  ownerPhone: string | null;
  ownerEmail: string | null;
  revealMethod?: 'free' | 'credit' | 'insufficient';
  creditPackSize?: number;
  creditPackPriceRupees?: number;
};

@Injectable()
export class ContactRevealService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(): Promise<ContactRevealSettingsDto> {
    const existing = await this.prisma.contactRevealSetting.findUnique({ where: { id: CONTACT_REVEAL_SETTINGS_ID } });
    if (existing) return existing;

    return this.prisma.contactRevealSetting.create({
      data: { id: CONTACT_REVEAL_SETTINGS_ID, ...DEFAULT_CONTACT_REVEAL_SETTINGS },
    });
  }

  async updateSettings(input: ContactRevealSettingsDto): Promise<ContactRevealSettingsDto> {
    return this.prisma.contactRevealSetting.upsert({
      where: { id: CONTACT_REVEAL_SETTINGS_ID },
      update: input,
      create: { id: CONTACT_REVEAL_SETTINGS_ID, ...input },
    });
  }

  private async hasCreditAvailable(userId: string): Promise<boolean> {
    const balance = await this.prisma.contactRevealCreditBatch.aggregate({
      where: { userId, expiresAt: { gt: new Date() }, creditsRemaining: { gt: 0 } },
      _sum: { creditsRemaining: true },
    });
    return (balance._sum.creditsRemaining ?? 0) > 0;
  }

  /** Called from ListingsService.toDetailDto for every listing-detail response — computes
   * whether THIS viewer has already unlocked THIS listing's contact, and if not, what unlocking
   * would cost. Always derived from a real ContactReveal row, never a cached flag (see that
   * model's own doc comment). `ownerPhone`/`ownerEmail` are the values already fetched by the
   * caller (from Listing.owner) — passed in rather than re-queried here, and only echoed back
   * when `contactRevealed` is true, so the caller can build a response that never carries them
   * otherwise. */
  async getRevealState(
    userId: string | null,
    listingId: string,
    ownerPhone: string | null,
    ownerEmail: string | null,
  ): Promise<ContactRevealState> {
    if (!userId) return { contactRevealed: false, ownerPhone: null, ownerEmail: null };

    const existing = await this.prisma.contactReveal.findUnique({
      where: { listingId_userId: { listingId, userId } },
    });
    if (existing) return { contactRevealed: true, ownerPhone, ownerEmail };

    const settings = await this.getSettings();
    const freeUsed = await this.prisma.contactReveal.count({ where: { userId, source: 'free' } });
    if (freeUsed < settings.freeRevealsPerUser) {
      return { contactRevealed: false, ownerPhone: null, ownerEmail: null, revealMethod: 'free' };
    }

    const hasCredit = await this.hasCreditAvailable(userId);
    return {
      contactRevealed: false,
      ownerPhone: null,
      ownerEmail: null,
      revealMethod: hasCredit ? 'credit' : 'insufficient',
      creditPackSize: settings.creditPackSize,
      creditPackPriceRupees: settings.creditPackPriceRupees,
    };
  }

  /** Batched counterpart to `getRevealState`, for a whole page of listing cards (browse grid,
   * favourites) — one settings read, one batch `ContactReveal` lookup, and one credit-balance
   * aggregate for the whole page, rather than three queries per card. The free-quota/credit
   * balance is a per-user property (same for every card on the page), so only whether each
   * individual listing has already been revealed differs per row. */
  async getRevealStatesForListings(
    userId: string | undefined,
    listings: { id: string; ownerPhone: string | null; ownerEmail: string | null }[],
  ): Promise<Map<string, ContactRevealState>> {
    const states = new Map<string, ContactRevealState>();
    if (!userId || listings.length === 0) return states;

    const revealed = await this.prisma.contactReveal.findMany({
      where: { userId, listingId: { in: listings.map((l) => l.id) } },
      select: { listingId: true },
    });
    const revealedIds = new Set(revealed.map((r) => r.listingId));

    const settings = await this.getSettings();
    const freeUsed = await this.prisma.contactReveal.count({ where: { userId, source: 'free' } });
    const freeAvailable = freeUsed < settings.freeRevealsPerUser;
    const hasCredit = freeAvailable ? false : await this.hasCreditAvailable(userId);

    for (const listing of listings) {
      if (revealedIds.has(listing.id)) {
        states.set(listing.id, { contactRevealed: true, ownerPhone: listing.ownerPhone, ownerEmail: listing.ownerEmail });
        continue;
      }
      states.set(listing.id, {
        contactRevealed: false,
        ownerPhone: null,
        ownerEmail: null,
        revealMethod: freeAvailable ? 'free' : hasCredit ? 'credit' : 'insufficient',
        ...(freeAvailable ? {} : { creditPackSize: settings.creditPackSize, creditPackPriceRupees: settings.creditPackPriceRupees }),
      });
    }
    return states;
  }

  /** A user's own standing, for the profile page's "contact reveal credits" card — see
   * ContactRevealBalanceDto's own doc comment. Not used by the reveal flow itself (that re-derives
   * eligibility inline, see getRevealState/revealContact above); this exists purely so a user can
   * check their balance without the listing-detail-page round trip that state is normally piggy-
   * backed on. */
  async getBalanceForUser(userId: string): Promise<ContactRevealBalanceDto> {
    const settings = await this.getSettings();
    const [freeUsed, batches] = await Promise.all([
      this.prisma.contactReveal.count({ where: { userId, source: 'free' } }),
      this.prisma.contactRevealCreditBatch.findMany({
        where: { userId, expiresAt: { gt: new Date() }, creditsRemaining: { gt: 0 } },
        orderBy: { expiresAt: 'asc' },
        select: { creditsRemaining: true, expiresAt: true },
      }),
    ]);

    return {
      freeRevealsRemaining: Math.max(0, settings.freeRevealsPerUser - freeUsed),
      creditsRemaining: batches.reduce((sum, b) => sum + b.creditsRemaining, 0),
      nextCreditExpiryAt: batches[0]?.expiresAt.toISOString() ?? null,
    };
  }

  /** Spends a free reveal or a credit (whichever applies) and permanently unlocks this listing's
   * contact for this user — idempotent (a second call is just a read) and transactional (re-
   * derives eligibility inside the transaction so two concurrent requests for the same listing
   * can't both succeed off a stale read). Mirrors messaging.service.ts's createOrGetConversation
   * idempotent-get-or-create shape. */
  async revealContact(userId: string, listingId: string): Promise<RevealContactResponseDto> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { owner: { select: { phone: true, email: true } } },
    });
    if (!listing) throw new NotFoundException(`Listing ${listingId} not found`);
    const { phone: ownerPhone, email: ownerEmail } = listing.owner;

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.contactReveal.findUnique({ where: { listingId_userId: { listingId, userId } } });
      if (existing) return { ownerPhone, ownerEmail };

      const settings =
        (await tx.contactRevealSetting.findUnique({ where: { id: CONTACT_REVEAL_SETTINGS_ID } })) ??
        DEFAULT_CONTACT_REVEAL_SETTINGS;
      const freeUsed = await tx.contactReveal.count({ where: { userId, source: 'free' } });
      if (freeUsed < settings.freeRevealsPerUser) {
        await tx.contactReveal.create({ data: { listingId, userId, source: 'free' } });
        return { ownerPhone, ownerEmail };
      }

      const batch = await tx.contactRevealCreditBatch.findFirst({
        where: { userId, expiresAt: { gt: new Date() }, creditsRemaining: { gt: 0 } },
        orderBy: { expiresAt: 'asc' },
      });
      if (!batch) throw new InsufficientContactRevealCreditsException();

      await tx.contactRevealCreditBatch.update({
        where: { id: batch.id },
        data: { creditsRemaining: { decrement: 1 } },
      });
      await tx.contactReveal.create({
        data: { listingId, userId, source: 'credit', creditBatchId: batch.id },
      });
      return { ownerPhone, ownerEmail };
    });
  }
}
