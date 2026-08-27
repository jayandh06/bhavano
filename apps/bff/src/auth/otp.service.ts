import { createHash, randomInt } from 'node:crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Pinned to the wording of the approved MSG91 DLT template ("Valid for 10 minutes"). Changing
 * this without changing the template — which needs a multi-day DLT re-approval — tells users one
 * thing and enforces another, and they'd be provably right when they complain. */
const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function hashCode(phone: string, code: string): string {
  return createHash('sha256').update(`${phone}:${code}`).digest('hex');
}

@Injectable()
export class OtpService {
  constructor(private readonly prisma: PrismaService) {}

  async createChallenge(phone: string): Promise<string> {
    const code = randomInt(100000, 1000000).toString();
    await this.prisma.otpChallenge.create({
      data: {
        phone,
        codeHash: hashCode(phone, code),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });
    return code;
  }

  /** Throws if the code is wrong/expired/attempts exhausted; resolves silently on success.
   *
   * `consume: false` validates without deleting the challenge, so a caller that has more to do
   * before committing — linkPhone discovering the number belongs to another account, and needing
   * the user to approve a merge — can re-verify the same code on the follow-up request instead of
   * making them request a second one. */
  async verifyChallenge(
    phone: string,
    code: string,
    options?: { consume?: boolean },
  ): Promise<void> {
    const challenge = await this.prisma.otpChallenge.findFirst({
      where: { phone },
      orderBy: { createdAt: 'desc' },
    });

    if (!challenge) {
      throw new BadRequestException(
        'No OTP request found for this phone number',
      );
    }
    if (challenge.attempts >= MAX_ATTEMPTS) {
      throw new BadRequestException('Too many attempts — request a new OTP');
    }
    if (challenge.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('OTP has expired — request a new one');
    }

    if (challenge.codeHash !== hashCode(phone, code)) {
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Incorrect OTP');
    }

    if (options?.consume !== false) {
      await this.prisma.otpChallenge.delete({ where: { id: challenge.id } });
    }
  }
}
