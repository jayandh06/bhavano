import { createHash, randomInt } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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
  ) {}

  /** Sends a code to `email`. Refuses addresses already held by someone else, since verifying
   * one would otherwise be the first half of taking their account. */
  async requestCode(userId: string, email: string): Promise<void> {
    const owner = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (owner && owner.id !== userId) {
      throw new ConflictException(
        'This email is already associated with another account',
      );
    }

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

  /** Marks the address verified on success. Throws on wrong/expired/exhausted, mirroring
   * OtpService.verifyChallenge. */
  async verifyCode(userId: string, email: string, code: string): Promise<void> {
    const challenge = await this.prisma.emailChallenge.findFirst({
      where: { userId, email },
      orderBy: { createdAt: 'desc' },
    });

    if (!challenge)
      throw new BadRequestException(
        'No verification request found for this email',
      );
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

    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { email, emailVerifiedAt: new Date() },
      });
    } catch {
      // Someone claimed the address between requestCode and now.
      throw new ConflictException(
        'This email is already associated with another account',
      );
    }

    await this.prisma.emailChallenge.deleteMany({ where: { userId, email } });
  }
}
