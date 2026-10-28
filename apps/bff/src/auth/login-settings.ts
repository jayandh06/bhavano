import { DEFAULT_EMAIL_LOGIN_MODE, isEmailLoginMode, type EmailLoginMode, type LoginSettingsDto } from '@bhavano/types/loginSettings';
import type { PrismaService } from '../prisma/prisma.service';

const SETTINGS_ID = 'default';

/** The current email-login mode. Any read problem (table not migrated yet during a deploy, a dropped connection, an unknown stored value) falls back to
 * "all": a settings fault must not lock people out of signing in. */
export async function getEmailLoginMode(prisma: PrismaService): Promise<EmailLoginMode> {
  try {
    const row = await prisma.loginSetting.findUnique({ where: { id: SETTINGS_ID } });
    return row && isEmailLoginMode(row.emailLogin) ? row.emailLogin : DEFAULT_EMAIL_LOGIN_MODE;
  } catch {
    return DEFAULT_EMAIL_LOGIN_MODE;
  }
}

export async function getLoginSettings(prisma: PrismaService): Promise<LoginSettingsDto> {
  return { emailLogin: await getEmailLoginMode(prisma) };
}

export async function setLoginSettings(prisma: PrismaService, input: LoginSettingsDto): Promise<LoginSettingsDto> {
  await prisma.loginSetting.upsert({
    where: { id: SETTINGS_ID },
    update: { emailLogin: input.emailLogin },
    create: { id: SETTINGS_ID, emailLogin: input.emailLogin },
  });
  return getLoginSettings(prisma);
}
