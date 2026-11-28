import { Controller, Get } from '@nestjs/common';
import type { FeaturedUpsellSettingsDto } from '@bhavano/types/featuredUpsell';
import { MARKET } from '../market/market-config';
import { PrismaService } from '../prisma/prisma.service';
import { getFeaturedUpsellSettings } from './featured-upsell-settings';

/** Public: the website reads these to decide whether to offer Featured to an owner. Only numbers and switches, nothing about any person. */
@Controller('featured-upsell')
export class FeaturedUpsellController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('settings')
  async settings(): Promise<FeaturedUpsellSettingsDto> {
    const settings = await getFeaturedUpsellSettings(this.prisma);
    // Nothing is sold in this market, so Featured is never offered, whatever the admin switches say.
    return MARKET.paymentsEnabled ? settings : { ...settings, enabled: false, listingCardEnabled: false };
  }
}
