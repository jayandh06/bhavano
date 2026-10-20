import { Injectable } from '@nestjs/common';
import type { AppVersionSettingsDto } from '@bhavano/types/appVersion';
import { PrismaService } from '../prisma/prisma.service';

export const APP_VERSION_SETTINGS_ID = 'singleton';

/** No minimum on either platform: until an admin sets one, nobody is blocked. */
export const DEFAULT_APP_VERSION_SETTINGS: AppVersionSettingsDto = {
  androidMinVersion: '',
  iosMinVersion: '',
  message: '',
};

function toDto(row: AppVersionSettingsDto): AppVersionSettingsDto {
  return { androidMinVersion: row.androidMinVersion, iosMinVersion: row.iosMinVersion, message: row.message };
}

@Injectable()
export class AppVersionService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(): Promise<AppVersionSettingsDto> {
    const existing = await this.prisma.appVersionSetting.findUnique({ where: { id: APP_VERSION_SETTINGS_ID } });
    // Read-only: a missing row is the default, not something a public request should insert.
    return existing ? toDto(existing) : { ...DEFAULT_APP_VERSION_SETTINGS };
  }

  async updateSettings(input: AppVersionSettingsDto): Promise<AppVersionSettingsDto> {
    const data = toDto(input);
    return toDto(
      await this.prisma.appVersionSetting.upsert({
        where: { id: APP_VERSION_SETTINGS_ID },
        update: data,
        create: { id: APP_VERSION_SETTINGS_ID, ...data },
      }),
    );
  }
}
