import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { AccountMergeSummary } from '@bhavano/types';
import { PrismaService } from '../prisma/prisma.service';

/** Combines two accounts belonging to the same person.
 *
 * Only ever called once ownership of BOTH is proven in the same session — the session proves one,
 * a fresh OTP or emailed code proves the other. That check lives at the call sites (linkPhone,
 * email verification), not here; this service assumes authorisation is already settled and
 * concerns itself with not losing anything.
 *
 * See docs/plans/account-linking-phone-and-email.md.
 */
@Injectable()
export class AccountMergeService {
  private readonly logger = new Logger(AccountMergeService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** What the account holds, for the confirmation prompt — and for deciding whether one is
   * needed at all. */
  async summarize(userId: string): Promise<AccountMergeSummary> {
    const [listings, subs, payments, conversations, favourites] =
      await Promise.all([
        this.prisma.listing.count({ where: { ownerId: userId } }),
        this.prisma.userSubscription.count({
          where: { userId, endsAt: { gt: new Date() } },
        }),
        this.prisma.payment.count({ where: { userId } }),
        this.prisma.conversation.count({
          where: { OR: [{ posterId: userId }, { inquirerId: userId }] },
        }),
        this.prisma.favourite.count({ where: { userId } }),
      ]);
    return {
      listings,
      activeSubscription: subs > 0,
      payments,
      conversations,
      favourites,
    };
  }

  /** Empty means nothing worth asking about. Favourites deliberately do not count — they are
   * trivially re-creatable and carry no obligation to anyone else, unlike a conversation, which
   * has a counterparty who never agreed to have their thread moved. */
  isEmpty(summary: AccountMergeSummary): boolean {
    return (
      summary.listings === 0 &&
      !summary.activeSubscription &&
      summary.payments === 0 &&
      summary.conversations === 0
    );
  }

  /** The account holding listings wins, whichever one the user happens to be signed into —
   * otherwise the merge direction depends on an accident of which login they used, and the
   * failure mode is merging away the account with their ads. */
  async pickWinner(
    a: string,
    b: string,
  ): Promise<{ winnerId: string; loserId: string }> {
    const [sa, sb] = await Promise.all([this.summarize(a), this.summarize(b)]);
    if (sa.listings !== sb.listings) {
      return sa.listings > sb.listings
        ? { winnerId: a, loserId: b }
        : { winnerId: b, loserId: a };
    }
    if (sa.payments !== sb.payments) {
      return sa.payments > sb.payments
        ? { winnerId: a, loserId: b }
        : { winnerId: b, loserId: a };
    }
    // Nothing to separate them — keep the session's account so the user stays where they are.
    return { winnerId: a, loserId: b };
  }

  /** Moves everything from `loserId` onto `winnerId` and retires the losing row.
   *
   * One transaction: a half-merged pair is worse than either outcome, because the user's listings
   * would be split across an account they can no longer reach.
   */
  async merge(winnerId: string, loserId: string): Promise<void> {
    if (winnerId === loserId) return;

    const [winner, loser] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: winnerId } }),
      this.prisma.user.findUnique({ where: { id: loserId } }),
    ]);
    if (!winner || !loser) throw new NotFoundException('Account not found');

    await this.prisma.$transaction(async (tx) => {
      const to = { userId: winnerId };

      // Every (userId, X) pair that's unique and could plausibly exist on both sides — a listing
      // both accounts favourited/showed interest in/revealed the contact for, or a calendar month
      // both hold an Agent Pro boost credit for. Same fix each time: drop the loser's duplicate
      // before repointing, rather than letting the whole merge fail on the constraint.
      const winnerFavs = await tx.favourite.findMany({ where: { userId: winnerId }, select: { listingId: true } });
      await tx.favourite.deleteMany({
        where: { userId: loserId, listingId: { in: winnerFavs.map((f) => f.listingId) } },
      });

      const winnerInterests = await tx.listingInterest.findMany({ where: { userId: winnerId }, select: { listingId: true } });
      await tx.listingInterest.deleteMany({
        where: { userId: loserId, listingId: { in: winnerInterests.map((i) => i.listingId) } },
      });

      const winnerReveals = await tx.contactReveal.findMany({ where: { userId: winnerId }, select: { listingId: true } });
      await tx.contactReveal.deleteMany({
        where: { userId: loserId, listingId: { in: winnerReveals.map((r) => r.listingId) } },
      });

      const winnerBoostCredits = await tx.proBoostCredit.findMany({ where: { userId: winnerId }, select: { monthKey: true } });
      await tx.proBoostCredit.deleteMany({
        where: { userId: loserId, monthKey: { in: winnerBoostCredits.map((c) => c.monthKey) } },
      });

      // BlockedUser has two FKs to User, so a collision can happen on either side, and a
      // self-block (winner had blocked loser, or vice versa) becomes nonsensical once both sides
      // are the same id — dropped outright rather than merged into a row nobody should see.
      await tx.blockedUser.deleteMany({
        where: {
          OR: [
            { blockerId: winnerId, blockedId: loserId },
            { blockerId: loserId, blockedId: winnerId },
          ],
        },
      });
      const winnerBlocked = await tx.blockedUser.findMany({ where: { blockerId: winnerId }, select: { blockedId: true } });
      await tx.blockedUser.deleteMany({
        where: { blockerId: loserId, blockedId: { in: winnerBlocked.map((b) => b.blockedId) } },
      });
      const winnerBlockedBy = await tx.blockedUser.findMany({ where: { blockedId: winnerId }, select: { blockerId: true } });
      await tx.blockedUser.deleteMany({
        where: { blockedId: loserId, blockerId: { in: winnerBlockedBy.map((b) => b.blockerId) } },
      });
      await Promise.all([
        tx.blockedUser.updateMany({ where: { blockerId: loserId }, data: { blockerId: winnerId } }),
        tx.blockedUser.updateMany({ where: { blockedId: loserId }, data: { blockedId: winnerId } }),
      ]);

      await Promise.all([
        tx.listing.updateMany({
          where: { ownerId: loserId },
          data: { ownerId: winnerId },
        }),
        tx.message.updateMany({
          where: { senderId: loserId },
          data: { senderId: winnerId },
        }),
        tx.conversation.updateMany({
          where: { posterId: loserId },
          data: { posterId: winnerId },
        }),
        tx.conversation.updateMany({
          where: { inquirerId: loserId },
          data: { inquirerId: winnerId },
        }),
        tx.favourite.updateMany({ where: { userId: loserId }, data: to }),
        tx.listingInterest.updateMany({ where: { userId: loserId }, data: to }),
        tx.contactReveal.updateMany({ where: { userId: loserId }, data: to }),
        tx.proBoostCredit.updateMany({ where: { userId: loserId }, data: to }),
        tx.payment.updateMany({ where: { userId: loserId }, data: to }),
        tx.userSubscription.updateMany({
          where: { userId: loserId },
          data: to,
        }),
        tx.savedSearch.updateMany({ where: { userId: loserId }, data: to }),
        tx.loginEvent.updateMany({ where: { userId: loserId }, data: to }),
        tx.visit.updateMany({ where: { userId: loserId }, data: to }),
        tx.supportTicket.updateMany({ where: { userId: loserId }, data: to }),
        tx.outreachCampaign.updateMany({
          where: { createdById: loserId },
          data: { createdById: winnerId },
        }),
        tx.requirement.updateMany({ where: { seekerId: loserId }, data: { seekerId: winnerId } }),
        tx.pushToken.updateMany({ where: { userId: loserId }, data: to }),
        tx.contactRevealCreditBatch.updateMany({ where: { userId: loserId }, data: to }),
        tx.discountCodeRedemption.updateMany({ where: { userId: loserId }, data: to }),
        tx.listingEditLog.updateMany({ where: { actorId: loserId }, data: { actorId: winnerId } }),
        tx.userNotificationLog.updateMany({ where: { userId: loserId }, data: to }),
        tx.searchEvent.updateMany({ where: { userId: loserId }, data: to }),
        tx.referral.updateMany({ where: { referrerId: loserId }, data: { referrerId: winnerId } }),
        tx.referralClick.updateMany({ where: { referrerId: loserId }, data: { referrerId: winnerId } }),
        tx.referralCreditBatch.updateMany({ where: { userId: loserId }, data: to }),
        tx.referralAdminAction.updateMany({ where: { targetUserId: loserId }, data: { targetUserId: winnerId } }),
      ]);

      // outreachContact and referralAsReferred are both 1:1 on userId. If the winner already has
      // one, the loser's is left in place pointing at the retired row rather than colliding — in
      // both cases it's attribution data (which campaign reached them, who referred them in) that
      // stays meaningful attached to the retired row, which is kept precisely so this works.
      const winnerContact = await tx.outreachContact.findUnique({
        where: { userId: winnerId },
      });
      if (!winnerContact) {
        await tx.outreachContact.updateMany({
          where: { userId: loserId },
          data: to,
        });
      }
      const winnerReferred = await tx.referral.findUnique({ where: { referredUserId: winnerId } });
      if (!winnerReferred) {
        await tx.referral.updateMany({ where: { referredUserId: loserId }, data: { referredUserId: winnerId } });
      }

      // Release the identifiers FIRST, preserving them for the audit trail. This has to precede
      // the winner update below: phone/email/googleId/appleId are @unique, so handing the
      // loser's email to the survivor while the loser still holds it fails on the constraint and
      // rolls back the whole merge.
      await tx.user.update({
        where: { id: loserId },
        data: {
          phone: null,
          email: null,
          googleId: null,
          appleId: null,
          mergedPhone: loser.phone,
          mergedEmail: loser.email,
          mergedIntoUserId: winnerId,
          mergedAt: new Date(),
        },
      });
      await tx.user.update({
        where: { id: winnerId },
        data: {
          // Entitlements take the MORE GENEROUS of the two — the user paid for both, and
          // silently shortening access they bought is the worst outcome of a merge.
          premiumUntil: laterOf(winner.premiumUntil, loser.premiumUntil),
          agentProUntil: laterOf(winner.agentProUntil, loser.agentProUntil),
          sellerSlotPackUntil: laterOf(
            winner.sellerSlotPackUntil,
            loser.sellerSlotPackUntil,
          ),
          agentProUnits: Math.max(winner.agentProUnits, loser.agentProUnits),
          // Fill only what the survivor is missing; never overwrite what it already has.
          phone: winner.phone ?? loser.phone,
          phoneVerifiedAt: winner.phoneVerifiedAt ?? loser.phoneVerifiedAt,
          email: winner.email ?? loser.email,
          emailVerifiedAt: winner.emailVerifiedAt ?? loser.emailVerifiedAt,
          googleId: winner.googleId ?? loser.googleId,
          appleId: winner.appleId ?? loser.appleId,
          name: winner.name ?? loser.name,
          cityId: winner.cityId ?? loser.cityId,
        },
      });
    });

    this.logger.log(`Merged account ${loserId} into ${winnerId}`);
  }

  /** Admin-initiated merge — see docs/plans/account-linking-phone-and-email.md's admin-merge
   * addendum. `confirmByIdentifier` below re-proves ownership with a fresh OTP/emailed code; an
   * admin picking two rows in the Users table has no equivalent proof, so this substitutes admin
   * judgement for cryptographic verification — which is exactly why every call is logged to
   * `UserMergeAction` (who, which two accounts, why) rather than executed silently the way the
   * self-service path is. Refuses staff accounts and anything already retired (merged or
   * self-deleted) — this tool is for "the same person signed up twice," not for touching staff
   * accounts or re-litigating a previous merge/deletion.
   */
  async mergeAsAdmin(adminId: string, winnerId: string, loserId: string, reason?: string): Promise<void> {
    if (winnerId === loserId) {
      throw new BadRequestException('Pick two different accounts to merge');
    }
    const [winner, loser] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: winnerId },
        select: { role: true, mergedIntoUserId: true, deletedAt: true },
      }),
      this.prisma.user.findUnique({
        where: { id: loserId },
        select: { role: true, mergedIntoUserId: true, deletedAt: true },
      }),
    ]);
    if (!winner || !loser) throw new NotFoundException('Account not found');
    if (winner.role === 'admin' || loser.role === 'admin') {
      throw new BadRequestException('Staff accounts cannot be merged from here');
    }
    if (winner.mergedIntoUserId || winner.deletedAt || loser.mergedIntoUserId || loser.deletedAt) {
      throw new BadRequestException('One of these accounts has already been merged or deleted');
    }

    await this.merge(winnerId, loserId);
    await this.prisma.userMergeAction.create({
      data: { adminId, winnerId, loserId, reason: reason ?? null },
    });
  }

  /** Executes a merge the user approved.
   *
   * Re-proves ownership rather than trusting that the earlier `confirm` response came from this
   * caller: the challenge deliberately survived that first request, so the same code is checked
   * again here. Without this the endpoint would merge any account whose phone or email a caller
   * could name.
   */
  async confirmByIdentifier(
    userId: string,
    identifier: { phone?: string; email?: string; code: string },
    verify: {
      phone: (phone: string, code: string) => Promise<void>;
      email: (userId: string, email: string, code: string) => Promise<void>;
    },
  ): Promise<void> {
    const { phone, email, code } = identifier;
    if (!phone === !email) {
      throw new BadRequestException('Provide exactly one of phone or email');
    }

    if (phone) {
      await verify.phone(phone, code);
    } else if (email) {
      await verify.email(userId, email, code);
    }

    const other = await this.prisma.user.findUnique({
      where: phone ? { phone } : { email: email! },
      select: { id: true },
    });
    if (!other)
      throw new NotFoundException('No other account holds that identifier');
    if (other.id === userId) return;

    const { winnerId, loserId } = await this.pickWinner(userId, other.id);
    await this.merge(winnerId, loserId);
  }

  /** Follows the merge chain to the account a session should actually act as. Depth-capped so a
   * cycle introduced by a future bug cannot hang a request. */
  async resolveActiveUserId(userId: string): Promise<string> {
    let current = userId;
    for (let hop = 0; hop < 5; hop++) {
      const user = await this.prisma.user.findUnique({
        where: { id: current },
        select: { mergedIntoUserId: true },
      });
      if (!user?.mergedIntoUserId) return current;
      current = user.mergedIntoUserId;
    }
    this.logger.error(
      `Merge chain from ${userId} exceeded 5 hops — possible cycle`,
    );
    return current;
  }
}

function laterOf(a: Date | null, b: Date | null): Date | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}
