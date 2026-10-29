import { Controller, Get } from '@nestjs/common';
import type { FeaturedUpsellSettingsDto } from '@bhavano/types/featuredUpsell';
import { PrismaService } from '../prisma/prisma.service';
import { getFeaturedUpsellSettings } from './featured-upsell-settings';

/** Public: the website reads these to decide whether to offer Featured to an owner. Only numbers and switches, nothing about any person. */
@Controller('featured-upsell')
export class FeaturedUpsellController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('settings')
  settings(): Promise<FeaturedUpsellSettingsDto> {
    return getFeaturedUpsellSettings(this.prisma);
  }
}
