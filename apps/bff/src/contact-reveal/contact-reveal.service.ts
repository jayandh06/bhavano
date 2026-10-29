import { ConflictException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import type { ContactRevealBalanceDto, ContactRevealSettingsDto, RevealContactResponseDto } from '@bhavano/types';
import { PrismaService } from '../prisma/prisma.service';
import { OwnerAlertsService } from '../owner-alerts/owner-alerts.service';
import { getPhoneRequirementMode } from '../auth/login-settings';
import { PHONE_VERIFICATION_REQUIRED_CODE } from '@bhavano/types/loginSettings';
import { BULK_IMPORT_OWNER_PHONE, OWNER_UNVERIFIED_MESSAGE } from '../listings/bulk-import-owner';
import { CONTACT_REVEAL_SETTINGS_ID, DEFAULT_CONTACT_REVEAL_SETTINGS } from './contact-reveal.constants';

const UNREVEALABLE: ContactRevealState = { contactRevealed: false, ownerPhone: null, ownerEmail: null };

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownerAlerts: OwnerAlertsService,
  ) {}

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
   * otherwise.
   *
   * `fallbackPhone`/`fallbackEmail` (the linked OutreachContact's own, if any) stand in for
   * `ownerPhone`/`ownerEmail` when the listing is still owned by the Bulk Import account: there's
   * nobody real to reveal the *owner's* contact for, but the scraped business itself can still be
   * reached until it's claimed — see bulk-import-owner.ts. Messaging stays blocked either way
   * (MessagingService's own OWNER_UNVERIFIED check, unaffected by this), since there's no Bhavano
   * inbox for an unclaimed business to read a message in. */
  async getRevealState(
    userId: string | null,
    listingId: string,
    ownerPhone: string | null,
    ownerEmail: string | null,
    fallbackPhone: string | null = null,
    fallbackEmail: string | null = null,
  ): Promise<ContactRevealState> {
    const isUnverified = ownerPhone === BULK_IMPORT_OWNER_PHONE;
    const revealPhone = isUnverified ? fallbackPhone : ownerPhone;
    const revealEmail = isUnverified ? fallbackEmail : ownerEmail;
    if (!userId || (isUnverified && !revealPhone && !revealEmail)) return UNREVEALABLE;

    const existing = await this.prisma.contactReveal.findUnique({
      where: { listingId_userId: { listingId, userId } },
    });
    if (existing) return { contactRevealed: true, ownerPhone: revealPhone, ownerEmail: revealEmail };

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
    listings: {
      id: string;
      ownerPhone: string | null;
      ownerEmail: string | null;
      // See getRevealState's doc comment — the linked OutreachContact's own phone/email, used
      // in place of ownerPhone/ownerEmail when this listing is still owned by the Bulk Import
      // account. Optional/undefined for a caller that doesn't track claimContact at all.
      fallbackPhone?: string | null;
      fallbackEmail?: string | null;
    }[],
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
      const isUnverified = listing.ownerPhone === BULK_IMPORT_OWNER_PHONE;
      const revealPhone = isUnverified ? listing.fallbackPhone ?? null : listing.ownerPhone;
      const revealEmail = isUnverified ? listing.fallbackEmail ?? null : listing.ownerEmail;
      if (isUnverified && !revealPhone && !revealEmail) {
        states.set(listing.id, UNREVEALABLE);
        continue;
      }
      if (revealedIds.has(listing.id)) {
        states.set(listing.id, { contactRevealed: true, ownerPhone: revealPhone, ownerEmail: revealEmail });
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
   * can't both succeed off a stale read). Mirrors messaging.service.ts's sendFirstMessage
   * idempotent-get-or-create shape. */
  async revealContact(userId: string, listingId: string): Promise<RevealContactResponseDto> {
    // Throwaway email accounts were collecting owners' numbers with their free reveals. While an admin has "mobile number required" on (Admin ->
    // Settings -> Login methods), an account with no verified phone cannot reveal anyone's contact until it adds one.
    if ((await getPhoneRequirementMode(this.prisma)) === 'required') {
      const requester = await this.prisma.user.findUnique({ where: { id: userId }, select: { phone: true } });
      if (!requester?.phone) {
        throw new ForbiddenException({
          message: 'Verify your mobile number to view contact details.',
          code: PHONE_VERIFICATION_REQUIRED_CODE,
        });
      }
    }
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: {
        ownerId: true,
        title: true,
        instantAlertsUntil: true,
        owner: { select: { phone: true, email: true } },
        claimContact: { select: { phone: true, email: true } },
      },
    });
    if (!listing) throw new NotFoundException(`Listing ${listingId} not found`);
    // Same fallback as getRevealState: an unclaimed listing's "owner" is the Bulk Import
    // account, but the scraped business's own phone/email (if any) is still revealable.
    const isUnverified = listing.owner.phone === BULK_IMPORT_OWNER_PHONE;
    const ownerPhone = isUnverified ? listing.claimContact?.phone ?? null : listing.owner.phone;
    const ownerEmail = isUnverified ? listing.claimContact?.email ?? null : listing.owner.email;
    if (isUnverified && !ownerPhone && !ownerEmail) {
      throw new ConflictException({ message: OWNER_UNVERIFIED_MESSAGE, code: 'OWNER_UNVERIFIED' });
    }

    let created = false;
    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.contactReveal.findUnique({ where: { listingId_userId: { listingId, userId } } });
      if (existing) return { ownerPhone, ownerEmail };

      const settings =
        (await tx.contactRevealSetting.findUnique({ where: { id: CONTACT_REVEAL_SETTINGS_ID } })) ??
        DEFAULT_CONTACT_REVEAL_SETTINGS;
      const freeUsed = await tx.contactReveal.count({ where: { userId, source: 'free' } });
      if (freeUsed < settings.freeRevealsPerUser) {
        await tx.contactReveal.create({ data: { listingId, userId, source: 'free' } });
        created = true;
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
      created = true;
      return { ownerPhone, ownerEmail };
    });

    // Tell the advertiser a seeker just unlocked their number: the strongest buying signal they get, and one that used to reach nobody. Not for an unclaimed
    // bulk-import listing (its "owner" is the import account), and only the first reveal by this seeker (a repeat call is a plain read).
    // Never when the one revealing is staff (checking or testing an ad): the owner must not be told.
    if (created && !isUnverified && listing.ownerId !== userId) {
      void this.prisma.user
        .findUnique({ where: { id: userId }, select: { role: true } })
        .then((requester) =>
          requester?.role === 'admin'
            ? undefined
            : this.ownerAlerts
                .alert(listing.ownerId, {
                  kind: 'reveal',
                  listingId,
                  listingTitle: listing.title,
                  featured: (listing.instantAlertsUntil?.getTime() ?? 0) > Date.now(),
                })
                .then((channel) =>
                  channel ? this.prisma.listingNotificationLog.create({ data: { listingId, kind: 'contact_revealed', channel } }) : undefined,
                ),
        )
        .catch(() => undefined);
    }
    return result;
  }
}
