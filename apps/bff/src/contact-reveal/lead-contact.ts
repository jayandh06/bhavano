import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  LEAD_CONTACT_WINDOW_DAYS,
  maskPhone,
  normalizeContactShareChoice,
  seekerIsShareable,
  type LeadContactSummaryDto,
  type SeekerContactSettingsDto,
  type UnlockLeadContactResponseDto,
} from '@bhavano/types/seekerContact';
import type { PrismaService } from '../prisma/prisma.service';
import { BULK_IMPORT_OWNER_PHONE } from '../listings/bulk-import-owner';
import { isListingBoosted } from '../listings/listing-boost.util';
import { getSeekerContactSettings } from '../seeker-contact/seeker-contact-settings';
import { CONTACT_REVEAL_SETTINGS_ID, DEFAULT_CONTACT_REVEAL_SETTINGS } from './contact-reveal.constants';
import { InsufficientContactRevealCreditsException } from './contact-reveal.service';

/** The seeker, as the owner's interested list needs to judge them. */
export interface LeadSeeker {
  phone: string | null;
  phoneVerifiedAt: Date | null;
  role: string;
  contactShareChoice: string;
}

/** Whether this seeker's number may be shown to an owner at all (before any payment). Pure: every reason a lead is "Message only" lives here. */
export function leadPhoneIfShareable(
  settings: SeekerContactSettingsDto,
  seeker: LeadSeeker,
  lastSeenAt: Date,
  now: number = Date.now(),
): string | null {
  if (!settings.enabled) return null;
  // Staff checking or testing an ad are never a lead, and the bulk-import placeholder is not a person.
  if (seeker.role === 'admin') return null;
  if (!seeker.phone || !seeker.phoneVerifiedAt || seeker.phone === BULK_IMPORT_OWNER_PHONE) return null;
  if (!seekerIsShareable(settings.consentMode, normalizeContactShareChoice(seeker.contactShareChoice))) return null;
  if (now - lastSeenAt.getTime() > LEAD_CONTACT_WINDOW_DAYS * 24 * 60 * 60 * 1000) return null;
  return seeker.phone;
}

/** Free while the ad is Featured (or the owner has Agent Pro). */
export function ownerSeesLeadsFree(
  listing: { boostedUntil: Date | null },
  owner: { agentProUntil: Date | null },
  now: number = Date.now(),
): boolean {
  return isListingBoosted(listing, now) || (owner.agentProUntil?.getTime() ?? 0) > now;
}

/** What the owner's list shows for the given interests: summary for pricing the unlock, and per seeker the number (when allowed to be seen) or its mask. */
export async function buildLeadContactView(
  prisma: PrismaService,
  args: {
    listingId: string;
    ownerId: string;
    listing: { boostedUntil: Date | null };
    interests: { userId: string; lastSeenAt: Date; user: LeadSeeker }[];
  },
): Promise<{
  summary: LeadContactSummaryDto;
  byUser: Map<string, { contact: 'available' | 'unlockable' | 'none'; phone: string | null; phoneMasked: string | null }>;
}> {
  const settings = await getSeekerContactSettings(prisma);
  const byUser = new Map<string, { contact: 'available' | 'unlockable' | 'none'; phone: string | null; phoneMasked: string | null }>();
  const reveal = (await prisma.contactRevealSetting.findUnique({ where: { id: CONTACT_REVEAL_SETTINGS_ID } })) ?? DEFAULT_CONTACT_REVEAL_SETTINGS;
  const emptySummary: LeadContactSummaryDto = {
    enabled: false,
    featured: false,
    freeLeadReveals: 0,
    creditsRemaining: 0,
    creditPackSize: reveal.creditPackSize,
    creditPackPriceRupees: reveal.creditPackPriceRupees,
  };
  if (!settings.enabled) {
    for (const i of args.interests) byUser.set(i.userId, { contact: 'none', phone: null, phoneMasked: null });
    return { summary: emptySummary, byUser };
  }

  const now = Date.now();
  const [owner, revealedRows, freeUsed, credits] = await Promise.all([
    prisma.user.findUnique({ where: { id: args.ownerId }, select: { agentProUntil: true } }),
    prisma.leadContactReveal.findMany({
      where: { listingId: args.listingId, seekerId: { in: args.interests.map((i) => i.userId) } },
      select: { seekerId: true },
    }),
    prisma.leadContactReveal.count({ where: { ownerId: args.ownerId, source: 'free' } }),
    prisma.contactRevealCreditBatch.aggregate({
      where: { userId: args.ownerId, expiresAt: { gt: new Date() }, creditsRemaining: { gt: 0 } },
      _sum: { creditsRemaining: true },
    }),
  ]);
  const featured = ownerSeesLeadsFree(args.listing, { agentProUntil: owner?.agentProUntil ?? null }, now);
  const revealed = new Set(revealedRows.map((r) => r.seekerId));

  for (const i of args.interests) {
    const phone = leadPhoneIfShareable(settings, i.user, i.lastSeenAt, now);
    if (!phone) byUser.set(i.userId, { contact: 'none', phone: null, phoneMasked: null });
    else if (featured || revealed.has(i.userId)) byUser.set(i.userId, { contact: 'available', phone, phoneMasked: null });
    else byUser.set(i.userId, { contact: 'unlockable', phone: null, phoneMasked: maskPhone(phone) });
  }

  return {
    summary: {
      enabled: true,
      featured,
      freeLeadReveals: Math.max(0, settings.freeLeadRevealsPerOwner - freeUsed),
      creditsRemaining: credits._sum.creditsRemaining ?? 0,
      creditPackSize: reveal.creditPackSize,
      creditPackPriceRupees: reveal.creditPackPriceRupees,
    },
    byUser,
  };
}

/**
 * The owner opens (or pays for) one lead's number. Featured: just records that they looked. Otherwise spends a free lead unlock or one credit and keeps the lead
 * unlocked for good — idempotent per (ad, seeker), and eligibility is re-derived inside the transaction so two taps cannot both spend off a stale read (the same
 * shape as ContactRevealService.revealContact). Anything that makes a lead "Message only" (consent, no verified phone, too old, feature off) refuses without charging.
 */
export async function unlockLeadContact(
  prisma: PrismaService,
  ownerId: string,
  listingId: string,
  seekerId: string,
): Promise<UnlockLeadContactResponseDto> {
  const settings = await getSeekerContactSettings(prisma);
  if (!settings.enabled) throw new NotFoundException('Not available');

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { ownerId: true, boostedUntil: true, owner: { select: { agentProUntil: true } } },
  });
  if (!listing) throw new NotFoundException('Listing not found');
  if (listing.ownerId !== ownerId) throw new ForbiddenException('Not your listing');

  const interest = await prisma.listingInterest.findUnique({
    where: { listingId_userId: { listingId, userId: seekerId } },
    select: { lastSeenAt: true, user: { select: { phone: true, phoneVerifiedAt: true, role: true, contactShareChoice: true } } },
  });
  if (!interest) throw new NotFoundException('That person has not shown interest in this ad');
  const phone = leadPhoneIfShareable(settings, interest.user, interest.lastSeenAt);
  if (!phone) {
    throw new ConflictException({ message: 'This person’s number is not available. You can still message them.', code: 'LEAD_CONTACT_UNAVAILABLE' });
  }

  const stamp = () =>
    prisma.listingInterest.updateMany({ where: { listingId, userId: seekerId, contactViewedAt: null }, data: { contactViewedAt: new Date() } });

  if (ownerSeesLeadsFree(listing, listing.owner)) {
    await stamp();
    return { phone };
  }

  try {
    await prisma.$transaction(async (tx) => {
    if (await tx.leadContactReveal.findUnique({ where: { listingId_seekerId: { listingId, seekerId } } })) return;

    const free = (await tx.seekerContactSetting.findUnique({ where: { id: 'default' } }))?.freeLeadRevealsPerOwner ?? settings.freeLeadRevealsPerOwner;
    const freeUsed = await tx.leadContactReveal.count({ where: { ownerId, source: 'free' } });
    if (freeUsed < free) {
      await tx.leadContactReveal.create({ data: { listingId, ownerId, seekerId, source: 'free' } });
      return;
    }

    const batch = await tx.contactRevealCreditBatch.findFirst({
      where: { userId: ownerId, expiresAt: { gt: new Date() }, creditsRemaining: { gt: 0 } },
      orderBy: { expiresAt: 'asc' },
    });
    if (!batch) throw new InsufficientContactRevealCreditsException();
    await tx.contactRevealCreditBatch.update({ where: { id: batch.id }, data: { creditsRemaining: { decrement: 1 } } });
    await tx.leadContactReveal.create({ data: { listingId, ownerId, seekerId, source: 'credit', creditBatchId: batch.id } });
    });
  } catch (err) {
    // Two taps at once: the other one created the row first, and this transaction (spend included) rolled back. The lead is unlocked either way.
    if ((err as { code?: string })?.code !== 'P2002') throw err;
  }
  await stamp();
  return { phone };
}
