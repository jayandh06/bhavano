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
      // Listings come offline but the rows stay, so the payments that boosted them and the
      // conversations buyers had about them remain coherent.
      await tx.listing.updateMany({
        where: { ownerId: userId },
        data: { status: 'deactivated' },
      });

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
