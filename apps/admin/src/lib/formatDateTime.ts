const IST_TIME_ZONE = "Asia/Kolkata";

/** Every timestamp in the admin app renders in IST explicitly, regardless of the server or
 * viewer's own timezone — the app host runs UTC, and admins are assumed to always be reading
 * these from India. Passing `timeZone` isn't optional decoration: without it, `Date.prototype
 * .toLocale*` methods fall back to the runtime's own zone, which for a date near midnight IST can
 * silently render the wrong calendar day, not just the wrong clock time. */

/** Date only, no time-of-day — e.g. "2 Sept 2026". No "IST" suffix: a bare date doesn't carry the
 * same at-a-glance ambiguity a clock time does, but the timeZone is still load-bearing for which
 * day it resolves to. */
export function formatDate(value: string | Date): string {
  return new Date(value).toLocaleDateString("en-IN", { timeZone: IST_TIME_ZONE, dateStyle: "medium" });
}

/** Date and time — e.g. "2 Sept 2026, 5:36 pm IST". The explicit suffix is the point: without it,
 * a reader has no way to tell this isn't their own browser's local time. */
export function formatDateTime(value: string | Date): string {
  const formatted = new Date(value).toLocaleString("en-IN", {
    timeZone: IST_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  });
  return `${formatted} IST`;
}
