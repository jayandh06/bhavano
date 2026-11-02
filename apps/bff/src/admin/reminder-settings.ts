import type { ReminderSettingsDto } from '@bhavano/types';
import type { PrismaService } from '../prisma/prisma.service';

const SETTINGS_ID = 'default';

export const DEFAULT_REMINDER_SETTINGS: ReminderSettingsDto = {
  featuredExpiryEnabled: true,
  featuredExpiryDays: [3, 1],
  followupEnabled: true,
  followupHours: [4, 24, 72],
  feedbackRequestEnabled: true,
  feedbackRequestHours: 48,
};

export const MAX_FEEDBACK_REQUEST_HOURS = 168;

function cleanHours(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= MAX_FEEDBACK_REQUEST_HOURS ? n : fallback;
}

export const MAX_FEATURED_EXPIRY_DAYS = 14;
export const MAX_FEATURED_EXPIRY_STAGES = 4;
export const MAX_FOLLOWUP_HOURS = 720;
export const MAX_FOLLOWUP_STAGES = 5;

/** Sorted, de-duplicated, whole numbers within range; falls back to the default when nothing usable is left. */
export function cleanList(values: unknown, min: number, max: number, maxCount: number, fallback: number[]): number[] {
  if (!Array.isArray(values)) return fallback;
  const cleaned = [...new Set(values.map(Number).filter((n) => Number.isInteger(n) && n >= min && n <= max))].slice(0, maxCount);
  return cleaned.length > 0 ? cleaned : fallback;
}

/** The timing the reminder jobs use, as set in Admin → Settings → Reminders. A read failure (table not migrated yet during a
 * deploy, a dropped connection) falls back to the defaults so a reminder run is never lost to a settings problem. */
export async function getReminderSettings(prisma: PrismaService): Promise<ReminderSettingsDto> {
  try {
    const row = await prisma.reminderSetting.findUnique({ where: { id: SETTINGS_ID } });
    if (!row) return DEFAULT_REMINDER_SETTINGS;
    return {
      featuredExpiryEnabled: row.featuredExpiryEnabled,
      // Largest first: the reminder furthest from the end goes out first.
      featuredExpiryDays: cleanList(row.featuredExpiryDays, 1, MAX_FEATURED_EXPIRY_DAYS, MAX_FEATURED_EXPIRY_STAGES, DEFAULT_REMINDER_SETTINGS.featuredExpiryDays).sort((a, b) => b - a),
      followupEnabled: row.followupEnabled,
      followupHours: cleanList(row.followupHours, 1, MAX_FOLLOWUP_HOURS, MAX_FOLLOWUP_STAGES, DEFAULT_REMINDER_SETTINGS.followupHours).sort((a, b) => a - b),
      feedbackRequestEnabled: row.feedbackRequestEnabled,
      feedbackRequestHours: cleanHours(row.feedbackRequestHours, DEFAULT_REMINDER_SETTINGS.feedbackRequestHours),
    };
  } catch {
    return DEFAULT_REMINDER_SETTINGS;
  }
}

/** What a save carries: the feedback-request fields are optional so an older admin build's save still works. */
export type ReminderSettingsInput = Omit<ReminderSettingsDto, 'feedbackRequestEnabled' | 'feedbackRequestHours'> &
  Partial<Pick<ReminderSettingsDto, 'feedbackRequestEnabled' | 'feedbackRequestHours'>>;

export async function setReminderSettings(prisma: PrismaService, input: ReminderSettingsInput): Promise<ReminderSettingsDto> {
  const data = {
    featuredExpiryEnabled: input.featuredExpiryEnabled,
    featuredExpiryDays: cleanList(input.featuredExpiryDays, 1, MAX_FEATURED_EXPIRY_DAYS, MAX_FEATURED_EXPIRY_STAGES, DEFAULT_REMINDER_SETTINGS.featuredExpiryDays),
    followupEnabled: input.followupEnabled,
    followupHours: cleanList(input.followupHours, 1, MAX_FOLLOWUP_HOURS, MAX_FOLLOWUP_STAGES, DEFAULT_REMINDER_SETTINGS.followupHours),
    // Absent from an older admin build's save: keep the defaults rather than failing the whole save.
    feedbackRequestEnabled: input.feedbackRequestEnabled ?? DEFAULT_REMINDER_SETTINGS.feedbackRequestEnabled,
    feedbackRequestHours: cleanHours(input.feedbackRequestHours, DEFAULT_REMINDER_SETTINGS.feedbackRequestHours),
  };
  await prisma.reminderSetting.upsert({ where: { id: SETTINGS_ID }, update: data, create: { id: SETTINGS_ID, ...data } });
  return getReminderSettings(prisma);
}
