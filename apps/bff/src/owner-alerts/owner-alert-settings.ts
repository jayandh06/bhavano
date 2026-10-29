import type { OwnerAlertSettingsDto } from '@bhavano/types/ownerAlerts';
import type { PrismaService } from '../prisma/prisma.service';

const SETTINGS_ID = 'default';

/** Whether WhatsApp / SMS alerts also go to ads that are not Featured. Any read problem counts as "off": a settings fault must never start sending paid messages. */
export async function getOwnerAlertSettings(prisma: PrismaService): Promise<OwnerAlertSettingsDto> {
  try {
    const row = await prisma.ownerAlertSetting.findUnique({ where: { id: SETTINGS_ID } });
    return { whatsappForFreeAds: row?.whatsappForFreeAds ?? false, smsForFreeAds: row?.smsForFreeAds ?? false };
  } catch {
    return { whatsappForFreeAds: false, smsForFreeAds: false };
  }
}

export async function setOwnerAlertSettings(prisma: PrismaService, input: OwnerAlertSettingsDto): Promise<OwnerAlertSettingsDto> {
  const data = { whatsappForFreeAds: input.whatsappForFreeAds, smsForFreeAds: input.smsForFreeAds };
  await prisma.ownerAlertSetting.upsert({ where: { id: SETTINGS_ID }, update: data, create: { id: SETTINGS_ID, ...data } });
  return getOwnerAlertSettings(prisma);
}
