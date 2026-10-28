import {
  DEFAULT_EMAIL_LOGIN_MODE,
  effectivePhoneRequirement,
  DEFAULT_PHONE_REQUIREMENT_MODE,
  isEmailLoginMode,
  isPhoneRequirementMode,
  type EmailLoginMode,
  type LoginSettingsDto,
  type PhoneRequirementMode,
} from '@bhavano/types/loginSettings';
import type { PrismaService } from '../prisma/prisma.service';

const SETTINGS_ID = 'default';

/** Both login settings. Any read problem (table not migrated yet during a deploy, a dropped connection, an unknown stored value) falls back to the open defaults:
 * a settings fault must not lock people out of signing in or block anyone. */
export async function getLoginSettings(prisma: PrismaService): Promise<LoginSettingsDto> {
  try {
    const row = await prisma.loginSetting.findUnique({ where: { id: SETTINGS_ID } });
    return {
      emailLogin: row && isEmailLoginMode(row.emailLogin) ? row.emailLogin : DEFAULT_EMAIL_LOGIN_MODE,
      phoneRequirement: row && isPhoneRequirementMode(row.phoneRequirement) ? row.phoneRequirement : DEFAULT_PHONE_REQUIREMENT_MODE,
    };
  } catch {
    return { emailLogin: DEFAULT_EMAIL_LOGIN_MODE, phoneRequirement: DEFAULT_PHONE_REQUIREMENT_MODE };
  }
}

export async function getEmailLoginMode(prisma: PrismaService): Promise<EmailLoginMode> {
  return (await getLoginSettings(prisma)).emailLogin;
}

/** What accounts with no mobile number are asked to do right now (the migration login mode counts as "required"). */
export async function getPhoneRequirementMode(prisma: PrismaService): Promise<PhoneRequirementMode> {
  return effectivePhoneRequirement(await getLoginSettings(prisma));
}

export async function setLoginSettings(prisma: PrismaService, input: LoginSettingsDto): Promise<LoginSettingsDto> {
  const data = { emailLogin: input.emailLogin, phoneRequirement: input.phoneRequirement };
  await prisma.loginSetting.upsert({ where: { id: SETTINGS_ID }, update: data, create: { id: SETTINGS_ID, ...data } });
  return getLoginSettings(prisma);
}
