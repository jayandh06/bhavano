/** How close to its end a Featured ad has to be before the owner is reminded and My listings offers "Renew Feature". One number
 * for the reminder job (3 days and 1 day before) and the button, so the two never disagree. See
 * docs/plans/featured-expiry-reminder.md. */
export declare const FEATURED_RENEW_WINDOW_DAYS = 3;
/** True while the ad is Featured and its Feature period ends within the renewal window. */
export declare function featuredEndsSoon(boostedUntil: string | Date | null | undefined, now?: number): boolean;
