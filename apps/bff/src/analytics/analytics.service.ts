import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RecordVisitDto } from './dto/record-visit.dto';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Called once per browser session by web's middleware.ts (fire-and-forget, not awaited by the
   * page request) — upserted rather than created outright since a flaky network retry could send
   * the same sessionId twice; the second attempt is then just a no-op. */
  async recordVisit(dto: RecordVisitDto): Promise<void> {
    await this.prisma.visit.upsert({
      where: { sessionId: dto.sessionId },
      update: {},
      create: {
        sessionId: dto.sessionId,
        source: dto.source,
        medium: dto.medium,
        campaign: dto.campaign,
        landingPath: dto.landingPath,
      },
    });
  }

  /** Best-effort link from an anonymous session to the user who just logged in during it — only
   * ever fills a currently-null userId, so a session's attribution is never reassigned once set.
   * Called from AuthService after a successful login; a missing/unknown sessionId (e.g. cookies
   * blocked, or the /analytics/visit call above never landed) is silently a no-op. */
  async linkVisitToUser(sessionId: string, userId: string): Promise<void> {
    await this.prisma.visit.updateMany({
      where: { sessionId, userId: null },
      data: { userId },
    });
  }
}
