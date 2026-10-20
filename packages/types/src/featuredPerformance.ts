/** What a Featured ad has done for its owner so far — shown on the owner's edit page. Counts are
 * *unique new viewers / new enquiries / new contact reveals since the boost started*; "before" is the
 * same three counts over the ad's life before it was Featured, and is only present when that was long
 * enough (>= 1 day) for a per-day comparison to mean anything. See
 * docs/plans/featured-ad-benefits-and-media-limits.md (Phase 2). */
export interface FeaturedPerformanceDto {
  /** When the current/latest boost started. */
  since: string;
  /** When it ends (or ended). */
  until: string;
  /** True while the boost is still running. */
  active: boolean;
  /** Whole-or-fractional days between `since` and now (capped at the boost's own end). */
  daysFeatured: number;
  views: number;
  enquiries: number;
  contactReveals: number;
  before: {
    days: number;
    views: number;
    enquiries: number;
    contactReveals: number;
  } | null;
}

const DAY_MS = 86_400_000;

/** Pure so it can be tested without a DB: turns the raw counts into the DTO. */
export function buildFeaturedPerformance(input: {
  boostedFrom: Date;
  boostedUntil: Date;
  listingCreatedAt: Date;
  now: Date;
  during: { views: number; enquiries: number; contactReveals: number };
  beforeCounts: { views: number; enquiries: number; contactReveals: number };
}): FeaturedPerformanceDto {
  const { boostedFrom, boostedUntil, listingCreatedAt, now, during, beforeCounts } = input;
  const active = boostedUntil.getTime() > now.getTime();
  const end = active ? now : boostedUntil;
  const daysFeatured = Math.max(0, (end.getTime() - boostedFrom.getTime()) / DAY_MS);
  const daysBefore = (boostedFrom.getTime() - listingCreatedAt.getTime()) / DAY_MS;
  return {
    since: boostedFrom.toISOString(),
    until: boostedUntil.toISOString(),
    active,
    daysFeatured: Math.round(daysFeatured * 10) / 10,
    ...during,
    before: daysBefore >= 1 ? { days: Math.round(daysBefore * 10) / 10, ...beforeCounts } : null,
  };
}

/** Per-day rate, one decimal, for the "before vs Featured" line. 0 when there is no time span. */
export function perDay(count: number, days: number): number {
  return days > 0 ? Math.round((count / days) * 10) / 10 : 0;
}
