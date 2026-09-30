import { Injectable } from '@nestjs/common';
import type { LoginNudgeSettingsDto, PublicLoginNudgeDto } from '@bhavano/types';
import { PrismaService } from '../prisma/prisma.service';
import { ContactRevealService } from '../contact-reveal/contact-reveal.service';

export const LOGIN_NUDGE_SETTINGS_ID = 'singleton';

export const DEFAULT_LOGIN_NUDGE_SETTINGS: LoginNudgeSettingsDto = {
  webOneTapEnabled: false,
  webPromptEnabled: true,
  webPromptAfterDetailViews: 2,
  webPromptDelaySeconds: 10,
  excludeAdAndSearchLanding: true,
  webPromptRolloutPercent: 50,
  appPromptEnabled: true,
  appPromptAfterDetailViews: 1,
  dismissCooldownDays: 7,
};

function toDto(row: LoginNudgeSettingsDto): LoginNudgeSettingsDto {
  return {
    webOneTapEnabled: row.webOneTapEnabled,
    webPromptEnabled: row.webPromptEnabled,
    webPromptAfterDetailViews: row.webPromptAfterDetailViews,
    webPromptDelaySeconds: row.webPromptDelaySeconds,
    excludeAdAndSearchLanding: row.excludeAdAndSearchLanding,
    webPromptRolloutPercent: row.webPromptRolloutPercent,
    appPromptEnabled: row.appPromptEnabled,
    appPromptAfterDetailViews: row.appPromptAfterDetailViews,
    dismissCooldownDays: row.dismissCooldownDays,
  };
}

@Injectable()
export class LoginNudgeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contactRevealService: ContactRevealService,
  ) {}

  async getSettings(): Promise<LoginNudgeSettingsDto> {
    const existing = await this.prisma.loginNudgeSetting.findUnique({ where: { id: LOGIN_NUDGE_SETTINGS_ID } });
    if (existing) return toDto(existing);
    return toDto(
      await this.prisma.loginNudgeSetting.create({
        data: { id: LOGIN_NUDGE_SETTINGS_ID, ...DEFAULT_LOGIN_NUDGE_SETTINGS },
      }),
    );
  }

  async updateSettings(input: LoginNudgeSettingsDto): Promise<LoginNudgeSettingsDto> {
    return toDto(
      await this.prisma.loginNudgeSetting.upsert({
        where: { id: LOGIN_NUDGE_SETTINGS_ID },
        update: input,
        create: { id: LOGIN_NUDGE_SETTINGS_ID, ...input },
      }),
    );
  }

  async getPublic(): Promise<PublicLoginNudgeDto> {
    const [settings, reveal] = await Promise.all([this.getSettings(), this.contactRevealService.getSettings()]);
    return { ...settings, freeRevealsPerUser: reveal.freeRevealsPerUser };
  }
}
