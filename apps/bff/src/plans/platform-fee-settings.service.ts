import { Injectable } from '@nestjs/common';
import type { PlatformFeeSettings } from '@bhavano/types/platformFeePricing';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_PLATFORM_FEE_SETTINGS, PLATFORM_FEE_SETTINGS_ID } from './plans.constants';

@Injectable()
export class PlatformFeeSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(): Promise<PlatformFeeSettings> {
    const existing = await this.prisma.platformFeeSetting.findUnique({ where: { id: PLATFORM_FEE_SETTINGS_ID } });
    if (existing) {
      return this.toSettings(existing);
    }

    const created = await this.prisma.platformFeeSetting.create({
      data: { id: PLATFORM_FEE_SETTINGS_ID, ...DEFAULT_PLATFORM_FEE_SETTINGS },
    });
    return this.toSettings(created);
  }

  async updateSettings(input: PlatformFeeSettings): Promise<PlatformFeeSettings> {
    const row = await this.prisma.platformFeeSetting.upsert({
      where: { id: PLATFORM_FEE_SETTINGS_ID },
      update: input,
      create: { id: PLATFORM_FEE_SETTINGS_ID, ...input },
    });
    return this.toSettings(row);
  }

  private toSettings(row: {
    propertyListingFee: number;
    coworkingPgStorageListingFee: number;
    furnitureInteriorsListingFee: number;
    allowLivePublishWithPendingPayment: boolean;
  }): PlatformFeeSettings {
    return {
      propertyListingFee: row.propertyListingFee,
      coworkingPgStorageListingFee: row.coworkingPgStorageListingFee,
      furnitureInteriorsListingFee: row.furnitureInteriorsListingFee,
      allowLivePublishWithPendingPayment: row.allowLivePublishWithPendingPayment,
    };
  }
}
