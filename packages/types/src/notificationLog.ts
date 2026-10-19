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
  /** Messages an admin sent into the owner's in-app Messages inbox (channel `in_app`). */
  inApp: number;
}

/** One recorded notification send, for the notification-log drill-down or a listing's history —
 * see AdminService.getNotificationDayDetail and getListingNotificationHistory.
 * `listingId`/`listingTitle` are present only for `ListingNotificationLog`-backed kinds (most of
 * them); `UserNotificationLog`-backed kinds (welcome, the daily activity digest) have neither.
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
  /** Provider callback status when available (WhatsApp); not all channels report it. For an in-app
   * message it comes from the message itself: `delivered` (in the owner's inbox, not opened yet),
   * `read` (the owner opened the thread) or `deleted`. */
  deliveryStatus?: string | null;
  /** When that status was reached: for an in-app message, when it was read (or deleted). */
  deliveryStatusAt?: string | null;
}
