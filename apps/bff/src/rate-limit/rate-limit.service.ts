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

  /** Listing publish rate limits were replaced by concurrent slot caps — publish kind is unused. */
  async checkAndRecordHit(userId: string, kind: RateLimitKind): Promise<void> {
    if (kind === 'publish') return;

    const settings = await this.getSettings();
    const limit = settings.viewLimit;
    const windowMinutes = settings.viewWindowMinutes;
    const identity = `user:${userId}`;
    const windowStart = new Date(Date.now() - windowMinutes * 60_000);

    const recentHits = await this.prisma.rateLimitHit.count({
      where: { identity, kind, createdAt: { gte: windowStart } },
    });
    if (recentHits >= limit) throw new ThrottlerException();

    await this.prisma.rateLimitHit.create({ data: { identity, kind } });
  }
}
