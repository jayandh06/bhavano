import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Deletes a user's own account.
 *
 * Anonymises rather than dropping the row. That is not a hedge: the row is the audit trail behind
 * their Payment records, and deleting it would either cascade real financial history away or
 * leave dangling references. What matters for both App Store guideline 5.1.1(v) and the DPDP
 * Act's erasure right is that the account becomes unusable and stops holding personal data —
 * which is what this does.
 *
 * Distinct from the merge path's soft delete (mergedIntoUserId), which retires an account into
 * another one that still belongs to the same person. Here nothing survives that identifies them.
 *
 * See docs/plans/ios-app-store-release.md.
 */
@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger(AccountDeletionService.name);

  constructor(private readonly prisma: PrismaService) {}

  async deleteOwnAccount(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('Account not found');
    if (user.deletedAt) return; // already gone — deleting twice is not an error

    await this.prisma.$transaction(async (tx) => {
      // Read each listing's own current status before the bulk update below overwrites it — a
      // ListingEditLog row needs a real before/after per listing, which updateMany's result
      // (just a count) can't supply. Excludes already-deactivated listings so closing one of
      // those again doesn't log a no-op "status changed" from deactivated to deactivated, same
      // guard ListingsService.setStatusAsAdmin applies.
      const listingsToDeactivate = await tx.listing.findMany({
        where: { ownerId: userId, status: { not: 'deactivated' } },
        select: { id: true, status: true },
      });

      // Listings come offline but the rows stay, so the payments that boosted them and the
      // conversations buyers had about them remain coherent.
      await tx.listing.updateMany({
        where: { ownerId: userId },
        data: { status: 'deactivated' },
      });

      // The listing's own "History" tab otherwise shows nothing for this — same action string
      // ListingsService.setStatusAsAdmin already uses for a status change, so it renders
      // identically there. actorType 'system' (not 'owner'): the owner isn't editing the listing,
      // this is a side effect of deleting their account, and actorId stays null to match this
      // actorType's only other documented convention (see ListingsService.listEditHistory's own
      // comment) — pointless to set it to an id this same transaction is about to anonymise.
      if (listingsToDeactivate.length > 0) {
        await tx.listingEditLog.createMany({
          data: listingsToDeactivate.map((listing) => ({
            listingId: listing.id,
            actorType: 'system',
            actorId: null,
            action: 'status_changed',
            changes: { status: { before: listing.status, after: 'deactivated' } },
          })),
        });
      }

      // Saved searches are per-user preferences with no audit value, and leaving them would keep
      // emailing a deleted account.
      await tx.savedSearch.deleteMany({ where: { userId } });

      await tx.user.update({
        where: { id: userId },
        data: {
          // Identifiers released so the number and address can be reused — the same rule the
          // merge follows, since a retained row would otherwise hold them forever.
          phone: null,
          email: null,
          googleId: null,
          appleId: null,
          phoneVerifiedAt: null,
          emailVerifiedAt: null,
          name: null,
          cityId: null,
          // Not preserved in mergedPhone/mergedEmail the way a merge does: this is an erasure
          // request, so keeping a copy would defeat it.
          acquisitionSource: null,
          acquisitionMedium: null,
          acquisitionCampaign: null,
          deletedAt: new Date(),
        },
      });
    });

    this.logger.log(`Account ${userId} deleted by its owner`);
  }
}
