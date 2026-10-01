/**
 * The boost-vs-unboosted comparison behind the post-ad preview step's "why boosting helps"
 * recovery dialog. See docs/plans/boost-recovery-dialog.md — computed nightly from real
 * ListingView/ListingInterest history (BoostEffectivenessStatService), never fabricated copy.
 */
export interface BoostEffectivenessDto {
  avgViews7dBoosted: number;
  avgViews7dUnboosted: number;
  /** 0-1, the share of listings with at least one ListingInterest row in their first 7 days live. */
  contactRate7dBoosted: number;
  contactRate7dUnboosted: number;
  boostedSampleSize: number;
  unboostedSampleSize: number;
  computedAt: string;
}

/** Below this, in either cohort, the comparison is too noisy to state as a number — a stat from a
 * handful of listings can flip sign next week. Matches the real account history checked when this
 * was designed: ~17-18 total boosts in a month, so the boosted cohort is the one expected to be
 * the limiting side for a while yet. */
export const MIN_SAMPLE_SIZE = 10;

export interface BoostRecoveryMessage {
  /** True once both cohorts clear MIN_SAMPLE_SIZE — the headline quotes a real, specific number.
   * False means the honest, non-numeric fallback is used instead. */
  hasEnoughData: boolean;
  headline: string;
}

/** Pure so it's testable without a DB: given the cached stats (or none at all, before the first
 * nightly computation has ever run), decide what the dialog actually says. Prefers the contact
 * rate over raw views when there's a real lift to quote — "got a reply" is a more convincing,
 * more honest signal to a seller than a view count, which includes idle scrolling. */
export function boostRecoveryMessage(stats: BoostEffectivenessDto | null): BoostRecoveryMessage {
  const fallback: BoostRecoveryMessage = {
    hasEnoughData: false,
    headline: "Boosted ads get priority placement and reach more buyers.",
  };
  if (!stats) return fallback;
  if (stats.boostedSampleSize < MIN_SAMPLE_SIZE || stats.unboostedSampleSize < MIN_SAMPLE_SIZE) return fallback;

  if (stats.contactRate7dUnboosted > 0) {
    const lift = stats.contactRate7dBoosted / stats.contactRate7dUnboosted;
    if (lift > 1.05) {
      return {
        hasEnoughData: true,
        headline: `Boosted ads got contacted ${lift.toFixed(1)}x more often in their first week, on Bhavano's last month of listings.`,
      };
    }
  }
  if (stats.avgViews7dUnboosted > 0) {
    const lift = stats.avgViews7dBoosted / stats.avgViews7dUnboosted;
    if (lift > 1.05) {
      return {
        hasEnoughData: true,
        headline: `Boosted ads got ${lift.toFixed(1)}x more views in their first week, on Bhavano's last month of listings.`,
      };
    }
  }
  // Real data, but no measurable lift yet — the honest thing is the fallback, not a stat that
  // undersells (or wrongly oversells) itself.
  return fallback;
}
