/** One row of the admin campaign analytics table: how many visits a campaign, ad group, ad, source
 * or landing page brought, and how many of those sessions went on to each next step. Every count
 * is of sessions (a person who visits twice counts twice). See docs/plans/admin-campaign-analytics.md. */
export interface CampaignAnalyticsRowDto {
  /** Stable id of the group: a Google Ads id, `src:google / organic` for traffic that did not come
   * from an ad, or a landing path. */
  key: string;
  /** Campaign or ad group name when known, otherwise the id; the source for non-ad traffic. */
  label: string;
  /** True for a numbered Google Ads campaign, ad group or ad (so it can be drilled into). */
  fromAds: boolean;
  campaignId: string | null;
  campaignName: string | null;
  adGroupId: string | null;
  adGroupName: string | null;
  visits: number;
  /** Visits flagged as crawlers. Zero unless the Traffic filter lets bots in. */
  bots: number;
  /** Visited two or more pages. */
  engaged: number;
  /** Opened the /post page. */
  reachedPost: number;
  /** A new account was created in that session (within 24 hours of it starting). */
  signups: number;
  /** An ad was posted from that session. */
  posted: number;
  /** The signed-in person paid for something within 24 hours of the session starting. */
  paid: number;
  /** Money received from those payments, in rupees. */
  revenue: number;
}

export interface CampaignAnalyticsTotals {
  visits: number;
  bots: number;
  engaged: number;
  reachedPost: number;
  signups: number;
  posted: number;
  paid: number;
  revenue: number;
}

export type CampaignAnalyticsGroupByDto = "campaign" | "adGroup" | "ad" | "source" | "landing";

export interface CampaignAnalyticsDto {
  from: string;
  to: string;
  groupBy: CampaignAnalyticsGroupByDto;
  rows: CampaignAnalyticsRowDto[];
  /** True when more rows matched than the limit shown. */
  truncated: boolean;
  /** Over every matching row, not only the ones shown. */
  totals: CampaignAnalyticsTotals;
}
