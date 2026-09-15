import { Injectable } from '@nestjs/common';
import type { InstantAlertsPriceSettings } from '@bhavano/types/instantAlertsPricing';
import { PrismaService } from '../prisma/prisma.service';
import { INSTANT_ALERTS_PRICE_SETTINGS_ID, DEFAULT_INSTANT_ALERTS_PRICE_SETTINGS } from './plans.constants';

@Injectable()
export class InstantAlertsPricingSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(): Promise<InstantAlertsPriceSettings> {
    const existing = await this.prisma.instantAlertsPriceSetting.findUnique({
      where: { id: INSTANT_ALERTS_PRICE_SETTINGS_ID },
    });
    if (existing) return existing;

    return this.prisma.instantAlertsPriceSetting.create({
      data: { id: INSTANT_ALERTS_PRICE_SETTINGS_ID, ...DEFAULT_INSTANT_ALERTS_PRICE_SETTINGS },
    });
  }

  async updateSettings(input: InstantAlertsPriceSettings): Promise<InstantAlertsPriceSettings> {
    return this.prisma.instantAlertsPriceSetting.upsert({
      where: { id: INSTANT_ALERTS_PRICE_SETTINGS_ID },
      update: input,
      create: { id: INSTANT_ALERTS_PRICE_SETTINGS_ID, ...input },
    });
  }
}
