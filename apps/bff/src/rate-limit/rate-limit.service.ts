import { Injectable } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { RateLimitKind, RateLimitSettingsDto } from '@bhavano/types';
import { PrismaService } from '../prisma/prisma.service';

const SETTINGS_ID = 'singleton';

const DEFAULTS: RateLimitSettingsDto = {
  publishLimit: 5,
  publishWindowMinutes: 1440,
  viewLimit: 200,
  viewWindowMinutes: 60,
  aiGenerateLimit: 10,
  aiGenerateWindowMinutes: 1440,
};

@Injectable()
export class RateLimitService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(): Promise<RateLimitSettingsDto> {
    const existing = await this.prisma.rateLimitSetting.findUnique({ where: { id: SETTINGS_ID } });
    if (existing) return existing;

    const created = await this.prisma.rateLimitSetting.create({ data: { id: SETTINGS_ID, ...DEFAULTS } });
    return created;
  }

  async updateSettings(input: RateLimitSettingsDto): Promise<RateLimitSettingsDto> {
    return this.prisma.rateLimitSetting.upsert({
      where: { id: SETTINGS_ID },
      update: input,
      create: { id: SETTINGS_ID, ...input },
    });
  }

  private async limitFor(kind: RateLimitKind): Promise<{ limit: number; windowMinutes: number }> {
    const settings = await this.getSettings();
    return kind === 'ai_generate'
      ? { limit: settings.aiGenerateLimit, windowMinutes: settings.aiGenerateWindowMinutes }
      : { limit: settings.viewLimit, windowMinutes: settings.viewWindowMinutes };
  }

  /** Listing publish rate limits were replaced by concurrent slot caps — publish kind is unused. */
  async checkAndRecordHit(userId: string, kind: RateLimitKind): Promise<void> {
    if (kind === 'publish') return;

    const { limit, windowMinutes } = await this.limitFor(kind);
    const identity = `user:${userId}`;
    const windowStart = new Date(Date.now() - windowMinutes * 60_000);

    const recentHits = await this.prisma.rateLimitHit.count({
      where: { identity, kind, createdAt: { gte: windowStart } },
    });
    if (recentHits >= limit) {
      // ThrottlerException's own default message ("ThrottlerException: Too Many Requests") is
      // the bare class name — both bffFetch (web) and BffError.userMessage (mobile) surface a
      // 4xx's `message` field verbatim to the user, so the default was reaching people as literal
      // exception-speak instead of something they could act on. Confirmed live 2026-10-07.
      throw new ThrottlerException(
        kind === 'ai_generate'
          ? "You've reached today's AI-generate limit — try again tomorrow, or write it yourself for now."
          : 'Too many requests — please wait a bit and try again.',
      );
    }

    await this.prisma.rateLimitHit.create({ data: { identity, kind } });
  }

  /** Read-only counterpart to `checkAndRecordHit` — lets a caller show "N left" up front instead
   * of a seller only ever finding out they're capped from a failed generate call. Never records a
   * hit itself; sharing `limitFor` with `checkAndRecordHit` is what keeps the two from drifting on
   * which settings columns a given `kind` reads. */
  async getUsage(userId: string, kind: RateLimitKind): Promise<{ used: number; limit: number; windowMinutes: number }> {
    const { limit, windowMinutes } = await this.limitFor(kind);
    const identity = `user:${userId}`;
    const windowStart = new Date(Date.now() - windowMinutes * 60_000);

    const used = await this.prisma.rateLimitHit.count({
      where: { identity, kind, createdAt: { gte: windowStart } },
    });
    return { used, limit, windowMinutes };
  }
}
