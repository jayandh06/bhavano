import { BadRequestException, Injectable } from '@nestjs/common';
import { enabledBoostDurations, type BoostPriceSettings } from '@bhavano/types/boostPricing';
import { PrismaService } from '../prisma/prisma.service';
import { BOOST_PRICE_SETTINGS_ID, DEFAULT_BOOST_PRICE_SETTINGS } from './plans.constants';

@Injectable()
export class BoostPricingSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(): Promise<BoostPriceSettings> {
    const existing = await this.prisma.boostPriceSetting.findUnique({ where: { id: BOOST_PRICE_SETTINGS_ID } });
    if (existing) return existing;

    return this.prisma.boostPriceSetting.create({
      data: { id: BOOST_PRICE_SETTINGS_ID, ...DEFAULT_BOOST_PRICE_SETTINGS },
    });
  }

  async updateSettings(input: BoostPriceSettings): Promise<BoostPriceSettings> {
    if (enabledBoostDurations(input).length === 0) {
      throw new BadRequestException('Keep at least one boost duration switched on');
    }
    return this.prisma.boostPriceSetting.upsert({
      where: { id: BOOST_PRICE_SETTINGS_ID },
      update: input,
      create: { id: BOOST_PRICE_SETTINGS_ID, ...input },
    });
  }
}
