import { DEFAULT_SEEKER_CONTACT_SETTINGS, type SeekerContactSettingsDto } from '@bhavano/types/seekerContact';
import type { PrismaService } from '../prisma/prisma.service';

const SETTINGS_ID = 'default';

/** The current settings. Any read problem (table not migrated yet during a deploy, a dropped connection) counts as "off": a settings fault must never start showing people's numbers. */
export async function getSeekerContactSettings(prisma: Pick<PrismaService, 'seekerContactSetting'>): Promise<SeekerContactSettingsDto> {
  try {
    const row = await prisma.seekerContactSetting.findUnique({ where: { id: SETTINGS_ID } });
    if (!row) return DEFAULT_SEEKER_CONTACT_SETTINGS;
    return {
      enabled: row.enabled,
      consentMode: row.consentMode === 'opt_in' ? 'opt_in' : 'notice',
      freeLeadRevealsPerOwner: row.freeLeadRevealsPerOwner,
    };
  } catch {
    return DEFAULT_SEEKER_CONTACT_SETTINGS;
  }
}

export async function setSeekerContactSettings(
  prisma: Pick<PrismaService, 'seekerContactSetting'>,
  input: SeekerContactSettingsDto,
): Promise<SeekerContactSettingsDto> {
  await prisma.seekerContactSetting.upsert({ where: { id: SETTINGS_ID }, update: input, create: { id: SETTINGS_ID, ...input } });
  return getSeekerContactSettings(prisma);
}
