import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RecordVisitDto } from './dto/record-visit.dto';
import { RecordPageViewDto } from './dto/record-pageview.dto';
import { GeoIpService } from './geoip.service';
import { deviceTypeFromUserAgent } from './device-type';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geoIp: GeoIpService,
  ) {}

  /** Called once per browser session by web's middleware.ts (fire-and-forget, not awaited by the
   * page request) — upserted rather than created outright since a flaky network retry could send
   * the same sessionId twice; the second attempt is then just a no-op. */
  async recordVisit(dto: RecordVisitDto): Promise<void> {
    // Admin-analytics label only — see docs/plans/visit-ip-city-logging.md. Never used to decide
    // what this visitor sees; GeoIpService returns null (not an error) when it can't resolve one.
    const geo = this.geoIp.lookupCity(dto.ip);
    await this.prisma.visit.upsert({
      where: { sessionId: dto.sessionId },
      update: {},
      create: {
        sessionId: dto.sessionId,
        source: dto.source,
        medium: dto.medium,
        campaign: dto.campaign,
        gclid: dto.gclid,
        campaignId: dto.campaignId,
        adGroupId: dto.adGroupId,
        adId: dto.adId,
        landingPath: dto.landingPath,
        ip: dto.ip,
        ipCity: geo?.city ?? null,
        ipRegion: geo?.region ?? null,
        ipCountry: geo?.country ?? null,
        deviceType: deviceTypeFromUserAgent(dto.userAgent, dto.fromApp ?? false),
      },
    });
  }

  /** Called on every real (non-prefetch) page navigation by web's middleware.ts — one row per
   * page view, not deduped like `recordVisit` above, since repeat views of the same path within
   * a session are genuine trail entries, not retries of the same write. */
  async recordPageView(dto: RecordPageViewDto): Promise<void> {
    await this.prisma.pageView.create({ data: { sessionId: dto.sessionId, path: dto.path } });
    await this.backfillMissingVisit(dto);
  }

  /**
   * Makes a session self-healing: `recordVisit` above only ever runs once, on the single request
   * where the session cookie was absent, as one fire-and-forget `event.waitUntil(fetch(...))`
   * whose failure web deliberately swallows. The cookie is set on that same response either way,
   * so if that one call doesn't land — transient error, a deploy mid-request — nothing retries
   * and the whole session is permanently absent from the admin Page visits screen, page-view
   * trail and all. This upsert closes that hole on the session's very next navigation.
   *
   * Attribution is deliberately left null rather than re-derived: by now the first-touch
   * source/medium for this session is genuinely unknown, and web's 30-day acquisition cookie is
   * first-touch across *sessions*, so reading it here would stamp this session with an earlier
   * one's source — turning missing data into wrong data, and inflating exactly the cpc counts
   * the admin screen is used to audit. A null `source` is distinguishable from a real direct
   * visit, which the middleware writes as the literal string "direct".
   */
  private async backfillMissingVisit(dto: RecordPageViewDto): Promise<void> {
    const geo = this.geoIp.lookupCity(dto.ip);
    await this.prisma.visit.upsert({
      where: { sessionId: dto.sessionId },
      // Untouched when the row already exists — this must never overwrite a real first-touch
      // row, nor re-anonymise one that login has since linked to a user.
      update: {},
      create: {
        sessionId: dto.sessionId,
        // The earliest path we can still prove this session visited, which is not necessarily
        // where it actually landed — the lost row's landingPath is unrecoverable.
        landingPath: dto.path,
        // Per-request facts, unlike attribution: this visitor's IP/device on a later navigation
        // is legitimately still theirs, so these stay accurate.
        ip: dto.ip,
        ipCity: geo?.city ?? null,
        ipRegion: geo?.region ?? null,
        ipCountry: geo?.country ?? null,
        deviceType: dto.userAgent ? deviceTypeFromUserAgent(dto.userAgent, false) : null,
      },
    });
  }

  /** Best-effort link from an anonymous session to the user who just logged in during it — only
   * ever fills a currently-null userId, so a session's attribution is never reassigned once set.
   * Called from AuthService after a successful login.
   *
   * When no row matches (the `recordVisit` call for this session never landed — see
   * `backfillMissingVisit`), one is created here rather than no-oping: a signup that the admin
   * Page visits screen can't see at all is worse than one with unknown attribution. This is how
   * ~7% of users came to have no visit row despite a real login. */
  async linkVisitToUser(sessionId: string, userId: string): Promise<void> {
    const { count } = await this.prisma.visit.updateMany({
      where: { sessionId, userId: null },
      data: { userId },
    });
    if (count > 0) return;

    // `upsert`, not `create` — the row may have appeared between the update above and now (the
    // session's own /analytics/visit call racing this login), in which case leave it alone: it
    // either already names this user or names another, and neither is ours to overwrite.
    await this.prisma.visit.upsert({
      where: { sessionId },
      update: {},
      create: { sessionId, userId },
    });
  }
}
