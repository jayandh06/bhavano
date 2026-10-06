import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma, BoostPriceSetting as BoostPriceSettingRow } from '@prisma/client';
import { enabledBoostDurations, type BoostPriceSettings, type BoostPricingRule } from '@bhavano/types/boostPricing';
import { PrismaService } from '../prisma/prisma.service';
import { BOOST_PRICE_SETTINGS_ID, DEFAULT_BOOST_PRICE_SETTINGS } from './plans.constants';

/** The JSON column round-trips through `Prisma.JsonValue` — this app already validates the
 * shape on the way in (UpdateBoostPricingDto), so a cast on the way out is the same trust
 * boundary every other settings read in this service already has for its non-JSON columns.
 * Exported (not private to this service) since payments.service.ts also reads this row
 * directly in a few places, rather than always going through `getSettings()`. */
export function toBoostPriceSettings(row: BoostPriceSettingRow): BoostPriceSettings {
  return { ...row, valueBandRules: (row.valueBandRules as BoostPricingRule[] | null) ?? undefined };
}

@Injectable()
export class BoostPricingSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(): Promise<BoostPriceSettings> {
    const existing = await this.prisma.boostPriceSetting.findUnique({ where: { id: BOOST_PRICE_SETTINGS_ID } });
    if (existing) return toBoostPriceSettings(existing);

    const created = await this.prisma.boostPriceSetting.create({
      data: {
        id: BOOST_PRICE_SETTINGS_ID,
        ...DEFAULT_BOOST_PRICE_SETTINGS,
        valueBandRules: DEFAULT_BOOST_PRICE_SETTINGS.valueBandRules as unknown as Prisma.InputJsonValue,
      },
    });
    return toBoostPriceSettings(created);
  }

  async updateSettings(input: BoostPriceSettings): Promise<BoostPriceSettings> {
    if (enabledBoostDurations(input).length === 0) {
      throw new BadRequestException('Keep at least one boost duration switched on');
    }
    const { valueBandRules, ...flatFields } = input;
    // Undefined (the field wasn't sent at all — the admin form hasn't been updated to include a
    // bands editor yet) leaves the column exactly as it was: omitted from the write entirely,
    // not written as null, since Prisma treats an explicit null and a missing key differently.
    // An explicit empty array IS written through, clearing every rule back to flat-tier-only.
    const valueBandRulesJson =
      valueBandRules === undefined ? undefined : (valueBandRules as unknown as Prisma.InputJsonValue);
    const data = { ...flatFields, ...(valueBandRulesJson !== undefined ? { valueBandRules: valueBandRulesJson } : {}) };
    const updated = await this.prisma.boostPriceSetting.upsert({
      where: { id: BOOST_PRICE_SETTINGS_ID },
      update: data,
      create: { id: BOOST_PRICE_SETTINGS_ID, ...data },
    });
    return toBoostPriceSettings(updated);
  }
}
