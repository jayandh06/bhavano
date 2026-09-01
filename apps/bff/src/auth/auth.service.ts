import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type {
  AuthSession,
  AuthUser,
  LinkIdentifierResult,
} from '@bhavano/types';
import { PrismaService } from '../prisma/prisma.service';
import type { User } from '@prisma/client';
import { OtpService } from './otp.service';
import { Msg91Provider } from '../notifications/providers/msg91.provider';
import { AccountMergeService } from '../users/account-merge.service';
import { GoogleProvider } from './providers/google.provider';
import { NotificationsService } from '../notifications/notifications.service';
import { AnalyticsService } from '../analytics/analytics.service';

const ACCESS_TOKEN_TTL = '1h';

/** Visit context passed up from the web app at signup — see AuthService.verifyOtp /
 * loginWithGoogle. All fields optional since anonymous/API callers (e.g. dev-login) never send
 * this and pre-existing users never had it captured. */
export interface VisitContext {
  source?: string;
  medium?: string;
  campaign?: string;
  /** The visitor's per-session id (web's `bhavano_sid` cookie) — used to link the anonymous
   * Visit row logged for this session to the now-known user, not persisted onto User itself. */
  sessionId?: string;
}

/** Only include acquisition columns in a Prisma `create` payload when a source was actually
 * captured — keeps the upsert's `update` branch untouched (it never mentions these fields), so a
 * returning user's original attribution is never overwritten. */
function acquisitionCreateFields(visit?: VisitContext) {
  if (!visit?.source) return {};
  return {
    acquisitionSource: visit.source,
    acquisitionMedium: visit.medium,
    acquisitionCampaign: visit.campaign,
  };
}

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
    private readonly accountMerge: AccountMergeService,
    private readonly googleProvider: GoogleProvider,
    private readonly notificationsService: NotificationsService,
    private readonly analyticsService: AnalyticsService,
    @InjectPinoLogger(AuthService.name) private readonly logger: PinoLogger,
  ) {}

  async sendOtp(phone: string): Promise<void> {
    const code = await this.otpService.createChallenge(phone);
    await this.msg91.sendOtp(phone, code);
  }

  async verifyOtp(
    phone: string,
    code: string,
    visit?: VisitContext,
  ): Promise<AuthSession> {
    await this.otpService.verifyChallenge(phone, code);

    const user = await this.prisma.user.upsert({
      where: { phone },
      update: { phoneVerifiedAt: new Date() },
      create: {
        phone,
        phoneVerifiedAt: new Date(),
        ...acquisitionCreateFields(visit),
      },
    });

    const isNewUser = !user.welcomedAt;
    const promoted = await this.promoteToAdminIfAllowlisted(user);
    await this.welcomeIfFirstLogin(promoted);
    await this.recordLogin(promoted.id, 'otp');
    this.linkVisitToUser(visit?.sessionId, promoted.id);
    return this.issueSession(promoted, isNewUser);
  }

  /** Links a verified phone number to the currently logged-in user — e.g. a Google-login
   * user completing their profile. Distinct from verifyOtp() (login/signup by phone), which
   * would otherwise upsert-by-phone and risk operating on a different user's account. */
  /** Validates an OTP without consuming it — used by the merge-confirm path, which needs the
   * same proof a second time after the user approves. */
  async assertOtpValid(phone: string, code: string): Promise<void> {
    await this.otpService.verifyChallenge(phone, code, { consume: false });
  }

  async linkPhone(
    userId: string,
    phone: string,
    code: string,
  ): Promise<LinkIdentifierResult> {
    // The OTP proves this number is theirs and the session proves the current account is theirs,
    // so when another account holds the number, one person owns both. This used to throw at
    // exactly this point, discarding the proof it had just obtained.
    // Not consumed yet: if this turns out to need the user's approval, the same code has to
    // still be valid when they confirm, rather than sending them a second one.
    await this.otpService.verifyChallenge(phone, code, { consume: false });

    const existing = await this.prisma.user.findUnique({ where: { phone } });

    if (existing && existing.id !== userId) {
      const summary = await this.accountMerge.summarize(existing.id);
      if (!this.accountMerge.isEmpty(summary))
        return { status: 'confirm', summary };

      await this.otpService.verifyChallenge(phone, code);
      const { winnerId, loserId } = await this.accountMerge.pickWinner(
        userId,
        existing.id,
      );
      await this.accountMerge.merge(winnerId, loserId);
      return { status: 'merged', reauthRequired: loserId === userId };
    }

    await this.otpService.verifyChallenge(phone, code);
    await this.prisma.user.update({
      where: { id: userId },
      data: { phone, phoneVerifiedAt: new Date() },
    });
    return { status: 'linked' };
  }

  async loginWithGoogle(
    idToken: string,
    visit?: VisitContext,
  ): Promise<AuthSession> {
    const profile = await this.googleProvider.verifyIdToken(idToken);

    // Adopt an existing account that already holds this address rather than creating a second
    // one — the phone-first-then-Google case, which otherwise leaves one person with two
    // accounts and their listings split between them.
    //
    // Gated on emailVerifiedAt, never on `email` alone: an address typed into the profile form
    // is an unproven claim, so adopting on it would let anyone take over the account of someone
    // who had not yet signed in with Google. See docs/plans/account-linking-phone-and-email.md.
    let user = await this.prisma.user.findUnique({
      where: { googleId: profile.googleId },
    });

    if (user) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          email: profile.email,
          name: profile.name,
          emailVerifiedAt: new Date(),
        },
      });
    } else {
      const byEmail = profile.email
        ? await this.prisma.user.findUnique({ where: { email: profile.email } })
        : null;

      user = byEmail?.emailVerifiedAt
        ? await this.prisma.user.update({
            where: { id: byEmail.id },
            // Their own name wins over Google's — someone who set it meant it.
            data: {
              googleId: profile.googleId,
              name: byEmail.name ?? profile.name,
            },
          })
        : await this.prisma.user.create({
            data: {
              googleId: profile.googleId,
              email: profile.email,
              name: profile.name,
              // Google asserts the address, so it is proven from the moment of creation.
              emailVerifiedAt: new Date(),
              ...acquisitionCreateFields(visit),
            },
          });
    }

    const isNewUser = !user.welcomedAt;
    const promoted = await this.promoteToAdminIfAllowlisted(user);
    await this.welcomeIfFirstLogin(promoted);
    await this.recordLogin(promoted.id, 'google');
    this.linkVisitToUser(visit?.sessionId, promoted.id);
    return this.issueSession(promoted, isNewUser);
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
    void this.notificationsService.notifyWelcome(user).then((channel) => {
      if (!channel) return;
      return this.prisma.userNotificationLog.create({
        data: { userId: user.id, kind: 'welcome', channel },
      });
    });
  }

  /** Best-effort, fire-and-forget: attaches the now-known user to the anonymous Visit row logged
   * for this browser session, if any. Not awaited — a failed/slow link should never add latency
   * to the login response, and a missing sessionId (cookies blocked, very old client) just means
   * no attribution, not an error. */
  private linkVisitToUser(sessionId: string | undefined, userId: string): void {
    if (!sessionId) return;
    void this.analyticsService
      .linkVisitToUser(sessionId, userId)
      .catch((err: unknown) =>
        this.logger.warn(
          { err, sessionId, userId },
          'Failed to link visit to user',
        ),
      );
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

  private issueSession(user: User, isNewUser?: boolean): AuthSession {
    const secret = this.config.get<string>('AUTH_JWT_SECRET');
    const accessToken = jwt.sign(
      { sub: user.id, role: user.role },
      secret ?? 'dev-only-change-me',
      {
        expiresIn: ACCESS_TOKEN_TTL,
      },
    );
    return { user: toAuthUser(user), accessToken, isNewUser };
  }
}
