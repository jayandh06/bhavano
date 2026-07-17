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

  /** Counts this user's hits of `kind` within the currently-configured window; throws
   * ThrottlerException (429) at/over the limit, otherwise records this attempt and allows it. */
  async checkAndRecordHit(userId: string, kind: RateLimitKind): Promise<void> {
    const settings = await this.getSettings();
    const limit = kind === 'publish' ? settings.publishLimit : settings.viewLimit;
    const windowMinutes = kind === 'publish' ? settings.publishWindowMinutes : settings.viewWindowMinutes;
    const identity = `user:${userId}`;
    const windowStart = new Date(Date.now() - windowMinutes * 60_000);

    const recentHits = await this.prisma.rateLimitHit.count({
      where: { identity, kind, createdAt: { gte: windowStart } },
    });
    if (recentHits >= limit) throw new ThrottlerException();

    await this.prisma.rateLimitHit.create({ data: { identity, kind } });
  }
}
