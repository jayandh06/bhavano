import { DEFAULT_FEATURED_UPSELL_SETTINGS, type FeaturedUpsellSettingsDto } from '@bhavano/types/featuredUpsell';
import type { PrismaService } from '../prisma/prisma.service';

const SETTINGS_ID = 'default';

/** The current settings. Any read problem (table not migrated yet during a deploy, a dropped connection) counts as "off": a settings fault must never start showing a sales prompt. */
export async function getFeaturedUpsellSettings(prisma: PrismaService): Promise<FeaturedUpsellSettingsDto> {
  try {
    const row = await prisma.featuredUpsellSetting.findUnique({ where: { id: SETTINGS_ID } });
    if (!row) return DEFAULT_FEATURED_UPSELL_SETTINGS;
    return {
      enabled: row.enabled,
      listingCardEnabled: row.listingCardEnabled,
      minAgeHours: row.minAgeHours,
      quietDays: row.quietDays,
      maxShowsPerAd: row.maxShowsPerAd,
    };
  } catch {
    return DEFAULT_FEATURED_UPSELL_SETTINGS;
  }
}

export async function setFeaturedUpsellSettings(prisma: PrismaService, input: FeaturedUpsellSettingsDto): Promise<FeaturedUpsellSettingsDto> {
  await prisma.featuredUpsellSetting.upsert({ where: { id: SETTINGS_ID }, update: input, create: { id: SETTINGS_ID, ...input } });
  return getFeaturedUpsellSettings(prisma);
}
