import { createHash, randomInt } from 'node:crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const OTP_TTL_MS = 5 * 60 * 1000;
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

  /** Throws if the code is wrong/expired/attempts exhausted; resolves silently on success. */
  async verifyChallenge(phone: string, code: string): Promise<void> {
    const challenge = await this.prisma.otpChallenge.findFirst({
      where: { phone },
      orderBy: { createdAt: 'desc' },
    });

    if (!challenge) {
      throw new BadRequestException('No OTP request found for this phone number');
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

    await this.prisma.otpChallenge.delete({ where: { id: challenge.id } });
  }
}
