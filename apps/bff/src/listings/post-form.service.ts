import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const POST_FORM_SETTINGS_ID = 'singleton';

/** The redesigned post-ad Details form is shown to `v2Percent` of visitors (0 to 100); admins always get it. See docs/plans/post-ad-simpler-form.md. */
export interface PostFormSettingsDto {
  v2Percent: number;
}

/** Nobody until an admin sets it: deploying never changes what visitors see on its own. */
export const DEFAULT_POST_FORM_SETTINGS: PostFormSettingsDto = { v2Percent: 0 };

function toDto(row: { v2Percent: number }): PostFormSettingsDto {
  // Belt and braces: the DTO already bounds it, but a bad row must never switch the new form on for everyone by accident.
  const percent = Number.isInteger(row.v2Percent) ? Math.min(100, Math.max(0, row.v2Percent)) : 0;
  return { v2Percent: percent };
}

@Injectable()
export class PostFormService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(): Promise<PostFormSettingsDto> {
    const existing = await this.prisma.postFormSetting.findUnique({ where: { id: POST_FORM_SETTINGS_ID } });
    if (existing) return toDto(existing);
    return toDto(
      await this.prisma.postFormSetting.create({ data: { id: POST_FORM_SETTINGS_ID, ...DEFAULT_POST_FORM_SETTINGS } }),
    );
  }

  async updateSettings(input: PostFormSettingsDto): Promise<PostFormSettingsDto> {
    return toDto(
      await this.prisma.postFormSetting.upsert({
        where: { id: POST_FORM_SETTINGS_ID },
        update: { v2Percent: input.v2Percent },
        create: { id: POST_FORM_SETTINGS_ID, v2Percent: input.v2Percent },
      }),
    );
  }
}
