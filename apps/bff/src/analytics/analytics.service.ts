import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RecordVisitDto } from './dto/record-visit.dto';
import { RecordPageViewDto } from './dto/record-pageview.dto';
import { GeoIpService } from './geoip.service';
import { isBotUserAgent } from '@bhavano/types/botUserAgent';
import { deviceTypeFromUserAgent } from './device-type';

/** How close together two views of the same path in the same session have to be before the
 * second is treated as a double-fire rather than a real re-visit. Two seconds: short enough that
 * a person genuinely returning to a page still gets counted, long enough to absorb a burst. */
const PAGE_VIEW_DEDUPE_MS = 2_000;

/**
 * Why every `Visit` write in this file is raw SQL rather than Prisma's typed API.
 *
 * Three callers write to the same `Visit` row, and they carry *independent* facts with different
 * lifetimes:
 *
 *   1. first-touch attribution (source/medium/campaign/gclid/campaignId/adGroupId/adId, plus the
 *      true landingPath) — knowable only on the session's landing request, from its query params
 *      and Referer. `recordVisit`.
 *   2. that the session exists at all, and what it is (ip/geo/deviceType/isBot) — observable on
 *      any request, which is what makes the self-healing `backfillMissingVisit` possible.
 *   3. which account it belongs to (userId) — known later, if the visitor logs in.
 *
 * Web's middleware fires the calls behind (1) and (2) at the same instant on a session's first
 * request, so for a brand-new `sessionId` they race. Prisma's `upsert` cannot express this: it is
 * a select-then-insert, so both callers see "no row", both insert, and the loser throws P2002 —
 * measured in production at 71% of `/analytics/visit` calls returning 500, each one taking that
 * session's whole attribution with it (web swallows the failure by design). Catching P2002 and
 * retrying worked, but it handles the race rather than removing it.
 *
 * `INSERT ... ON CONFLICT` does remove it: one atomic statement per writer, each touching only
 * the columns it owns and leaving the rest alone. There is no window between deciding and
 * writing, so no collision to catch. What Prisma's `upsert` lacks — and the reason for the raw
 * SQL — is per-column merge: its `update` is all-or-nothing.
 *
 * All values are passed as bound parameters via `$executeRaw` tagged templates, never interpolated
 * into the SQL text, so an attacker-supplied `source` or `landingPath` is data and nothing else.
 * Values are normalised to `null` rather than left `undefined`, which Prisma's raw layer does not
 * accept as a parameter.
 */

/* There is deliberately no P2002 handler left in this file. `ON CONFLICT` makes the collision
 * unreachable rather than recoverable, so a unique-constraint error arriving here would mean a
 * genuine bug — and it should surface, not be swallowed as "somebody else got there first". */

/** `Visit.id` is `@default(cuid())` in schema.prisma, which Prisma generates **client-side** — the
 * column itself has no database default (see the add_visit_log migration). Raw inserts therefore
 * have to supply one. `randomUUID` rather than a hand-rolled cuid: the id is an opaque TEXT
 * primary key, never parsed and never in a URL (the admin addresses these rows by `sessionId`), so
 * the only thing that matters is that it is unique. The alternative — giving the column a database
 * default — would leave schema.prisma and the database disagreeing, which this repo's
 * `migrate diff` workflow would then try to "correct" on the next unrelated schema change. */
function newVisitId(): string {
  return randomUUID();
}

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geoIp: GeoIpService,
  ) {}

  /** Called once per browser session by web's middleware.ts (fire-and-forget, not awaited by the
   * page request). The *only* call that carries a session's attribution, so it has to win over
   * `backfillMissingVisit` below regardless of which of the two reaches the database first.
   *
   * Writes the session's landing request in one statement: insert it, or — if the backfill got
   * there first — establish the first touch on the row that already exists. Every column is
   * governed by the single predicate `"Visit"."source" IS NULL`, deliberately, so attribution
   * lands as one unit and can never be half-written from two different requests. A row that
   * already carries a real source is a duplicate/retried send of the same sessionId and is left
   * completely untouched.
   *
   * `source IS NULL` is a reliable marker for "this row came from a recovery path, not a real
   * landing", because the middleware always sends *some* source — the literal string "direct"
   * when there is nothing better. And `sessionId` being unique means the row being completed is
   * always this same session, so this cannot reach another session's data.
   *
   * Note what is absent from the statement: `userId`. Login owns that column (see
   * linkVisitToUser), and a first-touch write must never be able to unclaim a session.
   */
  async recordVisit(dto: RecordVisitDto): Promise<void> {
    // Admin-analytics label only — see docs/plans/visit-ip-city-logging.md. Never used to decide
    // what this visitor sees; GeoIpService returns null (not an error) when it can't resolve one.
    const geo = this.geoIp.lookupCity(dto.ip);
    // Null when no UA was sent at all — "not classified", not "human"; see Visit.isBot's own
    // schema comment. Web's middleware already drops known crawlers before this endpoint, so a
    // `true` here means that list missed one.
    const isBot = dto.userAgent ? isBotUserAgent(dto.userAgent) : null;

    await this.prisma.$executeRaw`
      INSERT INTO "Visit" (
        "id", "sessionId", "source", "medium", "campaign", "gclid", "campaignId", "adGroupId",
        "adId", "landingPath", "ip", "ipCity", "ipRegion", "ipCountry", "deviceType", "isBot"
      ) VALUES (
        ${newVisitId()}, ${dto.sessionId}, ${dto.source ?? null}, ${dto.medium ?? null},
        ${dto.campaign ?? null}, ${dto.gclid ?? null}, ${dto.campaignId ?? null},
        ${dto.adGroupId ?? null}, ${dto.adId ?? null}, ${dto.landingPath ?? null},
        ${dto.ip ?? null}, ${geo?.city ?? null}, ${geo?.region ?? null}, ${geo?.country ?? null},
        ${deviceTypeFromUserAgent(dto.userAgent, dto.fromApp ?? false) ?? null}, ${isBot}
      )
      ON CONFLICT ("sessionId") DO UPDATE SET
        "source"      = CASE WHEN "Visit"."source" IS NULL THEN EXCLUDED."source"      ELSE "Visit"."source"      END,
        "medium"      = CASE WHEN "Visit"."source" IS NULL THEN EXCLUDED."medium"      ELSE "Visit"."medium"      END,
        "campaign"    = CASE WHEN "Visit"."source" IS NULL THEN EXCLUDED."campaign"    ELSE "Visit"."campaign"    END,
        "gclid"       = CASE WHEN "Visit"."source" IS NULL THEN EXCLUDED."gclid"       ELSE "Visit"."gclid"       END,
        "campaignId"  = CASE WHEN "Visit"."source" IS NULL THEN EXCLUDED."campaignId"  ELSE "Visit"."campaignId"  END,
        "adGroupId"   = CASE WHEN "Visit"."source" IS NULL THEN EXCLUDED."adGroupId"   ELSE "Visit"."adGroupId"   END,
        "adId"        = CASE WHEN "Visit"."source" IS NULL THEN EXCLUDED."adId"        ELSE "Visit"."adId"        END,
        -- Not attribution, but still authoritative here: these come from the session's actual
        -- landing request, so they beat the backfill's best-effort copy (which has only a later
        -- navigation's path, and a deviceType with no app=1 hint to recognise the mobile app's
        -- browser). Same predicate, so the whole row moves from "recovered" to "real" at once.
        "landingPath" = CASE WHEN "Visit"."source" IS NULL THEN EXCLUDED."landingPath" ELSE "Visit"."landingPath" END,
        "ip"          = CASE WHEN "Visit"."source" IS NULL THEN EXCLUDED."ip"          ELSE "Visit"."ip"          END,
        "ipCity"      = CASE WHEN "Visit"."source" IS NULL THEN EXCLUDED."ipCity"      ELSE "Visit"."ipCity"      END,
        "ipRegion"    = CASE WHEN "Visit"."source" IS NULL THEN EXCLUDED."ipRegion"    ELSE "Visit"."ipRegion"    END,
        "ipCountry"   = CASE WHEN "Visit"."source" IS NULL THEN EXCLUDED."ipCountry"   ELSE "Visit"."ipCountry"   END,
        "deviceType"  = CASE WHEN "Visit"."source" IS NULL THEN EXCLUDED."deviceType"  ELSE "Visit"."deviceType"  END,
        "isBot"       = CASE WHEN "Visit"."source" IS NULL THEN EXCLUDED."isBot"       ELSE "Visit"."isBot"       END
    `;
  }

  /** Called on every real (non-prefetch) page navigation by web's middleware.ts — one row per
   * page view, since repeat views of the same path within a session are genuine trail entries,
   * not retries of the same write.
   *
   * With one exception: the same path twice inside `PAGE_VIEW_DEDUPE_MS`. Nobody reads a page and
   * comes back to it in under two seconds, so that's either a double-fire or a background fetcher
   * web's middleware didn't recognise. A safety net, not the fix — the fix is the navigation gate
   * in middleware.ts, and this exists because that gate identifies request *shapes* and the next
   * unrecognised fetcher may present a new one. It would have removed the 3.51-views-per-path
   * duplication measured on 2026-09-16 on its own. Indexed by `@@index([sessionId, createdAt])`,
   * so it's one cheap lookup on a write path that is already fire-and-forget. */
  async recordPageView(dto: RecordPageViewDto): Promise<void> {
    const duplicate = await this.prisma.pageView.findFirst({
      where: {
        sessionId: dto.sessionId,
        path: dto.path,
        createdAt: { gte: new Date(Date.now() - PAGE_VIEW_DEDUPE_MS) },
      },
      select: { id: true },
    });
    // Nothing else to do: the view this duplicates already ran the backfill below.
    if (duplicate) return;

    await this.prisma.pageView.create({ data: { sessionId: dto.sessionId, path: dto.path } });
    await this.backfillMissingVisit(dto);
  }

  /**
   * Makes a session self-healing: `recordVisit` above only ever runs once, on the single request
   * where the session cookie was absent, as one fire-and-forget `event.waitUntil(fetch(...))`
   * whose failure web deliberately swallows. The cookie is set on that same response either way,
   * so if that one call doesn't land — transient error, a deploy mid-request — nothing retries
   * and the whole session is permanently absent from the admin Page visits screen, page-view
   * trail and all. This closes that hole on the session's very next navigation.
   *
   * It runs on a session's *first* page view too, not only later ones, even though
   * `/analytics/visit` is in flight for that same request — deliberately, because a session that
   * loses that call and then never navigates again would otherwise vanish entirely. That overlap
   * is what makes `recordVisit`'s conditional merge necessary rather than optional: this
   * frequently creates the row first, and the real attribution arrives afterwards.
   *
   * `DO NOTHING` is the whole of this writer's conflict handling, and it is exactly right: this
   * call owns no column that another writer could want. If the row exists — the normal case on
   * every navigation after the first, or `recordVisit` having just inserted it — the desired end
   * state has already been reached. It must never overwrite a real first-touch row, nor
   * re-anonymise one that login has since claimed.
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
    await this.prisma.$executeRaw`
      INSERT INTO "Visit" (
        "id", "sessionId", "landingPath", "ip", "ipCity", "ipRegion", "ipCountry", "deviceType", "isBot"
      ) VALUES (
        ${newVisitId()},
        ${dto.sessionId},
        -- The earliest path we can still prove this session visited, which is not necessarily
        -- where it actually landed — the lost row's landingPath is unrecoverable.
        ${dto.path},
        -- Per-request facts, unlike attribution: this visitor's IP/device on a later navigation
        -- is legitimately still theirs, so these stay accurate.
        ${dto.ip ?? null}, ${geo?.city ?? null}, ${geo?.region ?? null}, ${geo?.country ?? null},
        ${dto.userAgent ? deviceTypeFromUserAgent(dto.userAgent, false) : null},
        ${dto.userAgent ? isBotUserAgent(dto.userAgent) : null}
      )
      ON CONFLICT ("sessionId") DO NOTHING
    `;
  }

  /** Best-effort link from an anonymous session to the user who just logged in during it — only
   * ever fills a currently-null userId, so a session's attribution is never reassigned once set.
   * Called from AuthService after a successful login.
   *
   * When no row exists (the `recordVisit` call for this session never landed — see
   * `backfillMissingVisit`), one is created here rather than no-oping: a signup that the admin
   * Page visits screen can't see at all is worse than one with unknown attribution. This is how
   * ~7% of users came to have no visit row despite a real login.
   *
   * `userId` is the only column this writer owns, and the only one it touches — so it cannot
   * disturb attribution, and attribution's writer cannot unclaim a session. `COALESCE` gives the
   * "only ever fills a null" rule directly: a session already claimed by another account keeps
   * that account (two people on a shared desktop is a real case, and neither claim is ours to
   * overwrite). */
  async linkVisitToUser(sessionId: string, userId: string): Promise<void> {
    await this.prisma.$executeRaw`
      INSERT INTO "Visit" ("id", "sessionId", "userId")
      VALUES (${newVisitId()}, ${sessionId}, ${userId})
      ON CONFLICT ("sessionId") DO UPDATE SET
        "userId" = COALESCE("Visit"."userId", EXCLUDED."userId")
    `;
  }
}
