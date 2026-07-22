import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { AuthSession, AuthUser } from '@bhavano/types';
import { PrismaService } from '../prisma/prisma.service';
import type { User } from '@prisma/client';
import { OtpService } from './otp.service';
import { Msg91Provider } from '../notifications/providers/msg91.provider';
import { GoogleProvider } from './providers/google.provider';
import { NotificationsService } from '../notifications/notifications.service';

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
  return new Set(
    (raw ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly otpService: OtpService,
    private readonly msg91: Msg91Provider,
    private readonly googleProvider: GoogleProvider,
    private readonly notificationsService: NotificationsService,
    @InjectPinoLogger(AuthService.name) private readonly logger: PinoLogger,
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

    const promoted = await this.promoteToAdminIfAllowlisted(user);
    await this.welcomeIfFirstLogin(promoted);
    await this.recordLogin(promoted.id, 'otp');
    return this.issueSession(promoted);
  }

  /** Links a verified phone number to the currently logged-in user — e.g. a Google-login
   * user completing their profile. Distinct from verifyOtp() (login/signup by phone), which
   * would otherwise upsert-by-phone and risk operating on a different user's account. */
  async linkPhone(userId: string, phone: string, code: string): Promise<void> {
    await this.otpService.verifyChallenge(phone, code);

    const existing = await this.prisma.user.findUnique({ where: { phone } });
    if (existing && existing.id !== userId) {
      throw new ConflictException(
        'This phone number is already linked to another account',
      );
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { phone, phoneVerifiedAt: new Date() },
    });
  }

  async loginWithGoogle(idToken: string): Promise<AuthSession> {
    const profile = await this.googleProvider.verifyIdToken(idToken);

    const user = await this.prisma.user.upsert({
      where: { googleId: profile.googleId },
      update: { email: profile.email, name: profile.name },
      create: {
        googleId: profile.googleId,
        email: profile.email,
        name: profile.name,
      },
    });

    const promoted = await this.promoteToAdminIfAllowlisted(user);
    await this.welcomeIfFirstLogin(promoted);
    await this.recordLogin(promoted.id, 'google');
    return this.issueSession(promoted);
  }

  /** Test-only login used by the web app's Playwright smoke suite to bypass real OTP/Google
   * login (which can't be automated locally — MSG91 throws without real credentials, and
   * Google's OAuth flow has no dev bypass). The controller gates this behind NODE_ENV and
   * ALLOW_DEV_LOGIN before it ever reaches here; this just reuses issueSession() as-is rather
   * than duplicating its jwt.sign(...) logic. Looks up an existing (seeded) user only — never
   * creates one, so a typo'd phone fails loudly instead of silently minting a throwaway account. */
  async devLogin(phone: string): Promise<AuthSession> {
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) throw new NotFoundException(`No user found for phone ${phone}`);
    return this.issueSession(user);
  }

  /** Fires the first-login welcome email/SMS/WhatsApp exactly once per user — `welcomedAt` is
   * marked immediately (before the send even starts) so a concurrent duplicate login request
   * can't double-send, and the dispatch itself is fire-and-forget (not awaited) so three
   * external network calls never add latency to the login response. Best-effort, matching the
   * rest of NotificationsService: a failed send is logged, not retried. */
  private async welcomeIfFirstLogin(user: User): Promise<void> {
    if (user.welcomedAt) return;
    await this.prisma.user.update({
      where: { id: user.id },
      data: { welcomedAt: new Date() },
    });
    void this.notificationsService.notifyWelcome(user);
  }

  private recordLogin(
    userId: string,
    method: 'otp' | 'google',
  ): Promise<unknown> {
    // Alongside the DB row (used by the admin logins page), also emit a structured log line so
    // login shows up in the same Loki stream as everything else — bounding a user's session
    // together with the `logout` event below (see docs/plans/bff-loki-grafana-logging.md).
    this.logger.info({ event: 'login', userId, method }, 'User logged in');
    return this.prisma.loginEvent.create({ data: { userId, method } });
  }

  /** No token invalidation happens here — JWTs are short-lived (1h) and stateless by design, so
   * there's nothing server-side to revoke. This exists purely so the BFF has *any* visibility
   * into logout at all, since it's otherwise a frontend-only NextAuth event the BFF never sees. */
  logout(userId: string): void {
    this.logger.info({ event: 'logout', userId }, 'User logged out');
  }

  /** No admin signup/invite flow exists — a phone/email matching ADMIN_PHONES/ADMIN_EMAILS
   * gets promoted to admin automatically the moment they log in. */
  private async promoteToAdminIfAllowlisted(user: User): Promise<User> {
    if (user.role === 'admin') return user;

    const adminPhones = parseAllowlist(this.config.get<string>('ADMIN_PHONES'));
    const adminEmails = parseAllowlist(this.config.get<string>('ADMIN_EMAILS'));
    const isAllowlisted =
      (user.phone && adminPhones.has(user.phone)) ||
      (user.email && adminEmails.has(user.email));
    if (!isAllowlisted) return user;

    return this.prisma.user.update({
      where: { id: user.id },
      data: { role: 'admin' },
    });
  }

  private issueSession(user: User): AuthSession {
    const secret = this.config.get<string>('AUTH_JWT_SECRET');
    const accessToken = jwt.sign(
      { sub: user.id, role: user.role },
      secret ?? 'dev-only-change-me',
      {
        expiresIn: ACCESS_TOKEN_TTL,
      },
    );
    return { user: toAuthUser(user), accessToken };
  }
}
