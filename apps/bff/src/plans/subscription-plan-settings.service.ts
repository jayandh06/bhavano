import { Injectable } from '@nestjs/common';
import type { SubscriptionPlanSettings } from '@bhavano/types/subscriptionPricing';
import { PrismaService } from '../prisma/prisma.service';
import { SUBSCRIPTION_PLAN_SETTINGS_ID, DEFAULT_SUBSCRIPTION_PLAN_SETTINGS } from './plans.constants';

@Injectable()
export class SubscriptionPlanSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(): Promise<SubscriptionPlanSettings> {
    const existing = await this.prisma.subscriptionPlanSetting.findUnique({
      where: { id: SUBSCRIPTION_PLAN_SETTINGS_ID },
    });
    if (existing) return existing;

    return this.prisma.subscriptionPlanSetting.create({
      data: { id: SUBSCRIPTION_PLAN_SETTINGS_ID, ...DEFAULT_SUBSCRIPTION_PLAN_SETTINGS },
    });
  }

  async updateSettings(input: SubscriptionPlanSettings): Promise<SubscriptionPlanSettings> {
    return this.prisma.subscriptionPlanSetting.upsert({
      where: { id: SUBSCRIPTION_PLAN_SETTINGS_ID },
      update: input,
      create: { id: SUBSCRIPTION_PLAN_SETTINGS_ID, ...input },
    });
  }
}
