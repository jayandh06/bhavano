import type { PrismaService } from '../prisma/prisma.service';

const SETTINGS_ID = 'default';
/** Used until an admin saves a value. */
export const DEFAULT_POSTED_CONFIRMATION_DELAY_MINUTES = 60;
/** A day. Past this the "ad posted" message is no longer news, and a typo (6000) shouldn't hold
 * every seller's confirmation back for days. */
export const MAX_POSTED_CONFIRMATION_DELAY_MINUTES = 1440;

/** Minutes to hold the "your ad is posted" email/WhatsApp back, as set in Admin → Settings. */
export async function getPostedConfirmationDelayMinutes(prisma: PrismaService): Promise<number> {
  // A read failure (the table not migrated yet during a deploy, a dropped connection) must never
  // fail a seller's post, so it falls back to the default wait.
  try {
    const row = await prisma.postedConfirmationSetting.findUnique({ where: { id: SETTINGS_ID } });
    return row ? row.delayMinutes : DEFAULT_POSTED_CONFIRMATION_DELAY_MINUTES;
  } catch {
    return DEFAULT_POSTED_CONFIRMATION_DELAY_MINUTES;
  }
}

export async function setPostedConfirmationDelayMinutes(prisma: PrismaService, delayMinutes: number): Promise<number> {
  const row = await prisma.postedConfirmationSetting.upsert({
    where: { id: SETTINGS_ID },
    update: { delayMinutes },
    create: { id: SETTINGS_ID, delayMinutes },
  });
  return row.delayMinutes;
}
