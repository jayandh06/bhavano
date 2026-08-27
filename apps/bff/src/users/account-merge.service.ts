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

      // Favourites are (userId, listingId) unique, so a listing both accounts favourited would
      // collide — drop the loser's duplicates first rather than failing the whole merge.
      const winnerFavs = await tx.favourite.findMany({
        where: { userId: winnerId },
        select: { listingId: true },
      });
      await tx.favourite.deleteMany({
        where: {
          userId: loserId,
          listingId: { in: winnerFavs.map((f) => f.listingId) },
        },
      });

      await Promise.all([
        tx.listing.updateMany({
          where: { ownerId: loserId },
          data: { ownerId: winnerId },
        }),
        tx.favourite.updateMany({ where: { userId: loserId }, data: to }),
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
        tx.payment.updateMany({ where: { userId: loserId }, data: to }),
        tx.userSubscription.updateMany({
          where: { userId: loserId },
          data: to,
        }),
        tx.savedSearch.updateMany({ where: { userId: loserId }, data: to }),
        tx.proBoostCredit.updateMany({ where: { userId: loserId }, data: to }),
        tx.loginEvent.updateMany({ where: { userId: loserId }, data: to }),
        tx.visit.updateMany({ where: { userId: loserId }, data: to }),
        tx.supportTicket.updateMany({ where: { userId: loserId }, data: to }),
        tx.outreachCampaign.updateMany({
          where: { createdById: loserId },
          data: { createdById: winnerId },
        }),
      ]);

      // outreachContact is 1:1 on userId. If the winner already has one, the loser's is left in
      // place pointing at the retired row rather than colliding — it is attribution data, and
      // the retired row is kept precisely so such references stay valid.
      const winnerContact = await tx.outreachContact.findUnique({
        where: { userId: winnerId },
      });
      if (!winnerContact) {
        await tx.outreachContact.updateMany({
          where: { userId: loserId },
          data: to,
        });
      }

      // Release the identifiers FIRST, preserving them for the audit trail. This has to precede
      // the winner update below: phone/email/googleId are @unique, so handing the loser's email
      // to the survivor while the loser still holds it fails on the constraint and rolls back
      // the whole merge.
      await tx.user.update({
        where: { id: loserId },
        data: {
          phone: null,
          email: null,
          googleId: null,
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
          name: winner.name ?? loser.name,
          cityId: winner.cityId ?? loser.cityId,
        },
      });
    });

    this.logger.log(`Merged account ${loserId} into ${winnerId}`);
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
