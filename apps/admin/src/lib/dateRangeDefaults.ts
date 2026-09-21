/** Shared IST-calendar-day math for every admin screen's date-range filter.
 *
 * Dates round-trip through the URL as plain `YYYY-MM-DD` (so a native `<input type="date">`
 * reads them back directly) and only get widened to real instants right before a BFF call —
 * `istDayStart`/`istDayEnd` do that widening. `todayIST`/`daysAgoIST` compute the `YYYY-MM-DD`
 * values themselves, for both the quick presets (DateRangeFilter) and each page's own
 * default-to-"1 day" fallback when no range is in the URL at all.
 */

const IST_OFFSET = "+05:30";
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** An inclusive range from the start of the "from" day to the last millisecond of the "to" day,
 * both at +05:30 — unchanged from the logic this was extracted from
 * (page-visits/page.tsx's former local `istDayStart`/`istDayEnd`). */
export function istDayStart(d: string | undefined): string | undefined {
  return d ? `${d}T00:00:00.000${IST_OFFSET}` : undefined;
}

export function istDayEnd(d: string | undefined): string | undefined {
  return d ? `${d}T23:59:59.999${IST_OFFSET}` : undefined;
}

function istDateString(date: Date): string {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Today's IST calendar day as `YYYY-MM-DD`. */
export function todayIST(): string {
  return istDateString(new Date());
}

/** `YYYY-MM-DD` for the start of a `days`-day window ending today, IST — `daysAgoIST(1)` is
 * today itself (a 1-day window), `daysAgoIST(7)` is 6 days before today (a 7-day window
 * inclusive of today), and so on. */
export function daysAgoIST(days: number): string {
  return istDateString(new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000));
}
