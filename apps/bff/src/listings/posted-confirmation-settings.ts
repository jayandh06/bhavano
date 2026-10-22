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

export interface PostedTimingSettings {
  delayMinutes: number;
  /** Also keep a free ad off the site for `delayMinutes` instead of publishing it at once. */
  holdAdLive: boolean;
}

/** Both timing settings in one read. A read failure falls back to the default wait and no hold, so
 * a seller's post is never failed or hidden by a settings problem. */
export async function getPostedTimingSettings(prisma: PrismaService): Promise<PostedTimingSettings> {
  try {
    const row = await prisma.postedConfirmationSetting.findUnique({ where: { id: SETTINGS_ID } });
    return row
      ? { delayMinutes: row.delayMinutes, holdAdLive: row.holdAdLive }
      : { delayMinutes: DEFAULT_POSTED_CONFIRMATION_DELAY_MINUTES, holdAdLive: false };
  } catch {
    return { delayMinutes: DEFAULT_POSTED_CONFIRMATION_DELAY_MINUTES, holdAdLive: false };
  }
}

/** When a free ad should go live, or null to publish it now: only when an admin turned "keep the ad
 * off the site" on, with a wait above zero. The caller decides whether this ad is eligible at all
 * (a seller's own post, not assisted / bulk / awaiting checkout). */
export function scheduledPublishAt(now: Date, timing: PostedTimingSettings | null): Date | null {
  if (!timing || !timing.holdAdLive || timing.delayMinutes <= 0) return null;
  return new Date(now.getTime() + timing.delayMinutes * 60_000);
}

export async function setPostedTimingSettings(
  prisma: PrismaService,
  settings: { delayMinutes: number; holdAdLive?: boolean },
): Promise<PostedTimingSettings> {
  const { delayMinutes, holdAdLive } = settings;
  const row = await prisma.postedConfirmationSetting.upsert({
    where: { id: SETTINGS_ID },
    // holdAdLive left out keeps whatever is stored, so an older client that only sends the delay
    // cannot switch the hold off by accident.
    update: { delayMinutes, ...(holdAdLive === undefined ? {} : { holdAdLive }) },
    create: { id: SETTINGS_ID, delayMinutes, holdAdLive: holdAdLive ?? false },
  });
  return { delayMinutes: row.delayMinutes, holdAdLive: row.holdAdLive };
}

export async function setPostedConfirmationDelayMinutes(prisma: PrismaService, delayMinutes: number): Promise<number> {
  return (await setPostedTimingSettings(prisma, { delayMinutes })).delayMinutes;
}
