/** Per-calendar-day (IST) count of notifications sent on each channel — see
 * AdminService.getNotificationDailySummary and docs/plans/
 * owner-win-back-notifications-and-mobile-email-capture.md's Part D. Covers every notification
 * kind in the system (the existing real-time ones plus the posted-reminder/daily-digest jobs),
 * not just the new ones. */
export interface NotificationDaySummaryDto {
    /** `YYYY-MM-DD`, IST calendar day. */
    date: string;
    email: number;
    whatsapp: number;
    push: number;
}
/** One actual notification send, for a specific day's lazy-loaded drill-down — see
 * AdminService.getNotificationDayDetail. `listingId`/`listingTitle` are present only for
 * `ListingNotificationLog`-backed kinds (most of them); `UserNotificationLog`-backed kinds
 * (welcome, the daily activity digest) have neither. */
export interface NotificationLogEntryDto {
    kind: string;
    channel: string;
    sentAt: string;
    userId: string;
    userName: string | null;
    userPhone: string | null;
    userEmail: string | null;
    listingId?: string;
    listingTitle?: string;
}
