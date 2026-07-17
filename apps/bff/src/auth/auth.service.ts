import { ConflictException, Injectable } from '@nestjs/common';
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
    role: user.role,
  };
}

/** Comma-separated allowlist env vars — there's no admin invite/signup flow, so matching
 * one of these on login is how the first (and any subsequent) admin accounts get created. */
function parseAllowlist(raw: string | undefined): Set<string> {
  return new Set((raw ?? '').split(',').map((s) => s.trim()).filter(Boolean));
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

    return this.issueSession(await this.promoteToAdminIfAllowlisted(user));
  }

  /** Links a verified phone number to the currently logged-in user — e.g. a Google-login
   * user completing their profile. Distinct from verifyOtp() (login/signup by phone), which
   * would otherwise upsert-by-phone and risk operating on a different user's account. */
  async linkPhone(userId: string, phone: string, code: string): Promise<void> {
    await this.otpService.verifyChallenge(phone, code);

    const existing = await this.prisma.user.findUnique({ where: { phone } });
    if (existing && existing.id !== userId) {
      throw new ConflictException('This phone number is already linked to another account');
    }

    await this.prisma.user.update({ where: { id: userId }, data: { phone, phoneVerifiedAt: new Date() } });
  }

  async loginWithGoogle(idToken: string): Promise<AuthSession> {
    const profile = await this.googleProvider.verifyIdToken(idToken);

    const user = await this.prisma.user.upsert({
      where: { googleId: profile.googleId },
      update: { email: profile.email, name: profile.name },
      create: { googleId: profile.googleId, email: profile.email, name: profile.name },
    });

    return this.issueSession(await this.promoteToAdminIfAllowlisted(user));
  }

  /** No admin signup/invite flow exists — a phone/email matching ADMIN_PHONES/ADMIN_EMAILS
   * gets promoted to admin automatically the moment they log in. */
  private async promoteToAdminIfAllowlisted(user: User): Promise<User> {
    if (user.role === 'admin') return user;

    const adminPhones = parseAllowlist(this.config.get<string>('ADMIN_PHONES'));
    const adminEmails = parseAllowlist(this.config.get<string>('ADMIN_EMAILS'));
    const isAllowlisted = (user.phone && adminPhones.has(user.phone)) || (user.email && adminEmails.has(user.email));
    if (!isAllowlisted) return user;

    return this.prisma.user.update({ where: { id: user.id }, data: { role: 'admin' } });
  }

  private issueSession(user: User): AuthSession {
    const secret = this.config.get<string>('AUTH_JWT_SECRET');
    const accessToken = jwt.sign({ sub: user.id, role: user.role }, secret ?? 'dev-only-change-me', {
      expiresIn: ACCESS_TOKEN_TTL,
    });
    return { user: toAuthUser(user), accessToken };
  }
}
