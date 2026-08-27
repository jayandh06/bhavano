import { createHash, randomInt } from 'node:crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import type { LinkIdentifierResult } from '@bhavano/types';
import { PrismaService } from '../prisma/prisma.service';
import { AccountMergeService } from './account-merge.service';
import { EmailProvider } from '../notifications/providers/email.provider';

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

/** Salted with the email for the same reason OtpService salts with the phone: a bare 6-digit
 * code has only a million possible hashes, so an unsalted table would fall to a rainbow table
 * in one pass. */
function hashCode(email: string, code: string): string {
  return createHash('sha256').update(`${email}:${code}`).digest('hex');
}

/** Proves a user controls an email address.
 *
 * Exists because `emailVerifiedAt` is what account adoption keys on (see
 * docs/plans/account-linking-phone-and-email.md): an address typed into the profile form is a
 * claim, not evidence, and treating it as evidence would let anyone take over the account of
 * someone who had not yet signed in with Google.
 *
 * Mirrors OtpService deliberately — same TTL, same attempt cap, same hash-don't-store rule — so
 * there is one model of how a verification challenge behaves rather than two.
 */
@Injectable()
export class EmailVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailProvider,
    private readonly merge: AccountMergeService,
  ) {}

  /** Sends a code to `email`.
   *
   * Deliberately does NOT refuse an address held by another account: proving control of it is
   * exactly what authorises merging the two, so refusing here would preserve the dead end this
   * flow exists to remove. Nothing leaks either — the code goes to the address itself, so only
   * its real owner learns anything. */
  async requestCode(userId: string, email: string): Promise<void> {
    const code = randomInt(100000, 1000000).toString();
    await this.prisma.emailChallenge.create({
      data: {
        userId,
        email,
        codeHash: hashCode(email, code),
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      },
    });

    // Unlike moderation notifications, this one is the action rather than a side effect of it —
    // a user waiting on a code that was never sent has no way to proceed, so a failed send is
    // surfaced instead of logged and swallowed.
    const sent = await this.email.send(
      email,
      'Verify your email for Bhavano',
      `Your Bhavano verification code is ${code}.\n\nIt is valid for 10 minutes. If you didn't ask for this, you can ignore this email.`,
    );
    if (!sent) {
      throw new BadRequestException(
        "Couldn't send the verification email — please try again.",
      );
    }
  }

  /** Validates the code without consuming it — used by the confirm path, which has already
   * shown the user what a merge would move and now needs the same proof again. */
  async assertCodeValid(
    userId: string,
    email: string,
    code: string,
  ): Promise<void> {
    await this.checkChallenge(userId, email, code);
  }

  /** Marks the address verified on success. Throws on wrong/expired/exhausted, mirroring
   * OtpService.verifyChallenge. */
  async verifyCode(
    userId: string,
    email: string,
    code: string,
  ): Promise<LinkIdentifierResult> {
    await this.checkChallenge(userId, email, code);

    // The code proved this address is theirs; the session proves the current account is theirs.
    // If another account holds the address, one person owns both — so this is a merge, not a
    // conflict.
    const owner = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (owner && owner.id !== userId) {
      const summary = await this.merge.summarize(owner.id);
      if (!this.merge.isEmpty(summary)) return { status: 'confirm', summary };

      await this.prisma.emailChallenge.deleteMany({ where: { userId, email } });
      const { winnerId, loserId } = await this.merge.pickWinner(
        userId,
        owner.id,
      );
      await this.merge.merge(winnerId, loserId);
      return { status: 'merged', reauthRequired: loserId === userId };
    }

    await this.prisma.emailChallenge.deleteMany({ where: { userId, email } });
    await this.prisma.user.update({
      where: { id: userId },
      data: { email, emailVerifiedAt: new Date() },
    });
    return { status: 'linked' };
  }

  /** Shared validation: never consumes the challenge, so the caller decides when to commit.
   * A wrong code still burns an attempt — that is the brute-force bound. */
  private async checkChallenge(
    userId: string,
    email: string,
    code: string,
  ): Promise<void> {
    const challenge = await this.prisma.emailChallenge.findFirst({
      where: { userId, email },
      orderBy: { createdAt: 'desc' },
    });

    if (!challenge) {
      throw new BadRequestException(
        'No verification request found for this email',
      );
    }
    if (challenge.attempts >= MAX_ATTEMPTS) {
      throw new BadRequestException('Too many attempts — request a new code');
    }
    if (challenge.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Code has expired — request a new one');
    }
    if (challenge.codeHash !== hashCode(email, code)) {
      await this.prisma.emailChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Incorrect code');
    }
  }
}
