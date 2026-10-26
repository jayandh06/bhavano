/** How close to its end a Featured ad has to be before the owner is reminded and My listings offers "Renew Feature". One number
 * for the reminder job (3 days and 1 day before) and the button, so the two never disagree. See
 * docs/plans/featured-expiry-reminder.md. */
export const FEATURED_RENEW_WINDOW_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

/** True while the ad is Featured and its Feature period ends within the renewal window. */
export function featuredEndsSoon(boostedUntil: string | Date | null | undefined, now: number = Date.now()): boolean {
  if (!boostedUntil) return false;
  const end = new Date(boostedUntil).getTime();
  return end > now && end - now <= FEATURED_RENEW_WINDOW_DAYS * DAY_MS;
}
