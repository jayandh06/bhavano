import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import type { AuthSession, AuthUser } from '@bhavano/types';
import { PrismaService } from '../prisma/prisma.service';
import type { User } from '@prisma/client';
import { OtpService } from './otp.service';
import { Msg91Provider } from './providers/msg91.provider';
import { GoogleProvider } from './providers/google.provider';

const ACCESS_TOKEN_TTL = '1h';

function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    phone: user.phone ?? undefined,
    email: user.email ?? undefined,
    name: user.name ?? undefined,
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly otpService: OtpService,
    private readonly msg91: Msg91Provider,
    private readonly googleProvider: GoogleProvider,
  ) {}

  async sendOtp(phone: string): Promise<void> {
    const code = await this.otpService.createChallenge(phone);
    await this.msg91.sendOtp(phone, code);
  }

  async verifyOtp(phone: string, code: string): Promise<AuthSession> {
    await this.otpService.verifyChallenge(phone, code);

    const user = await this.prisma.user.upsert({
      where: { phone },
      update: { phoneVerifiedAt: new Date() },
      create: { phone, phoneVerifiedAt: new Date() },
    });

    return this.issueSession(user);
  }

  async loginWithGoogle(idToken: string): Promise<AuthSession> {
    const profile = await this.googleProvider.verifyIdToken(idToken);

    const user = await this.prisma.user.upsert({
      where: { googleId: profile.googleId },
      update: { email: profile.email, name: profile.name },
      create: { googleId: profile.googleId, email: profile.email, name: profile.name },
    });

    return this.issueSession(user);
  }

  private issueSession(user: User): AuthSession {
    const secret = this.config.get<string>('AUTH_JWT_SECRET');
    const accessToken = jwt.sign({ sub: user.id }, secret ?? 'dev-only-change-me', {
      expiresIn: ACCESS_TOKEN_TTL,
    });
    return { user: toAuthUser(user), accessToken };
  }
}
