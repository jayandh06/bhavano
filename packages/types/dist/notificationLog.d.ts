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
 * (welcome, the daily activity digest) have neither.
 *
 * `userId`/`userName`/`userPhone`/`userEmail` are all null only for a `saved_search_match` row
 * logged before `ListingNotificationLog.userId` existed — that kind notifies the seeker whose
 * alert matched, not the listing's own owner, and the old rows never recorded who that was, so
 * there's nothing honest to show for them. Every other row (including newer `saved_search_match`
 * ones) always has a real recipient here. */
export interface NotificationLogEntryDto {
    kind: string;
    channel: string;
    sentAt: string;
    userId: string | null;
    userName: string | null;
    userPhone: string | null;
    userEmail: string | null;
    listingId?: string;
    listingTitle?: string;
}
