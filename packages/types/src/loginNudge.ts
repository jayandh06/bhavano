/**
 * When the dismissible login ask on listing detail may appear — shared by web and app so both
 * read the admin settings the same way. The listing itself is never gated; see
 * docs/plans/listing-detail-login-nudge.md for why each web rule exists (search rankings and
 * Google Ads landing-page experience).
 */

/** How a browser visit began: a paid ad click, an organic search result, or anything else. */
export type VisitEntry = "ad" | "search" | "other";

const AD_CLICK_PARAMS = ["gclid", "gbraid", "wbraid", "msclkid", "fbclid"];
const PAID_MEDIUMS = new Set(["cpc", "ppc", "paid", "paidsearch", "paid_search", "paid-social", "paidsocial"]);
const SEARCH_ENGINE_HOST = /(^|\.)(google|bing|yahoo|duckduckgo|yandex|baidu|ecosia|search\.brave)\.[a-z.]+$/i;

/** Query parameters as a plain map. Hand-parsed because this package has no DOM types, and so no
 * URLSearchParams. */
function queryParams(search: string): Map<string, string> {
  const params = new Map<string, string>();
  for (const pair of search.replace(/^\?/, "").split("&")) {
    if (!pair) continue;
    const [rawKey, rawValue = ""] = pair.split("=");
    try {
      params.set(decodeURIComponent(rawKey), decodeURIComponent(rawValue.replace(/\+/g, " ")));
    } catch {
      // Malformed escape: skip the pair.
    }
  }
  return params;
}

/** Classifies the first page of a visit from its query string and `document.referrer`. */
export function classifyVisitEntry(search: string, referrer: string): VisitEntry {
  const params = queryParams(search);
  if (AD_CLICK_PARAMS.some((p) => params.has(p))) return "ad";
  const medium = params.get("utm_medium")?.toLowerCase();
  if (medium && PAID_MEDIUMS.has(medium)) return "ad";
  const host = /^[a-z][a-z0-9+.-]*:\/\/([^/?#:]+)/i.exec(referrer)?.[1];
  if (host && SEARCH_ENGINE_HOST.test(host)) return "search";
  return "other";
}

/** Stable 0–99 bucket for a viewer key, so the same visitor stays in or out of a rollout. */
export function rolloutBucket(viewerKey: string): number {
  let hash = 0;
  for (let i = 0; i < viewerKey.length; i++) hash = (hash * 31 + viewerKey.charCodeAt(i)) >>> 0;
  return hash % 100;
}

export function inDismissCooldown(dismissedAtMs: number | null, cooldownDays: number, nowMs: number): boolean {
  return dismissedAtMs != null && nowMs - dismissedAtMs < cooldownDays * 86_400_000;
}

/** Hard floor on the web: the card never shows on the first listing of a visit, whatever the
 * setting says, so a visitor arriving from search or an ad never gets it on their landing page. */
export const WEB_PROMPT_MIN_DETAIL_VIEWS = 2;

export function shouldShowWebLoginPrompt(input: {
  enabled: boolean;
  afterDetailViews: number;
  rolloutPercent: number;
  excludeAdAndSearchLanding: boolean;
  cooldownDays: number;
  /** Listing detail pages opened in this browser session, including the current one. */
  detailViewsThisSession: number;
  visitEntry: VisitEntry;
  viewerKey: string;
  dismissedAtMs: number | null;
  shownThisSession: boolean;
  nowMs: number;
}): boolean {
  if (!input.enabled || input.shownThisSession) return false;
  if (input.detailViewsThisSession < Math.max(WEB_PROMPT_MIN_DETAIL_VIEWS, input.afterDetailViews)) return false;
  if (input.excludeAdAndSearchLanding && input.visitEntry !== "other") return false;
  if (rolloutBucket(input.viewerKey) >= input.rolloutPercent) return false;
  return !inDismissCooldown(input.dismissedAtMs, input.cooldownDays, input.nowMs);
}

export function shouldShowAppLoginPrompt(input: {
  enabled: boolean;
  afterDetailViews: number;
  cooldownDays: number;
  /** Listing detail screens opened since the last skip (or ever, before the first one). */
  detailViews: number;
  dismissedAtMs: number | null;
  nowMs: number;
}): boolean {
  if (!input.enabled) return false;
  if (input.detailViews < Math.max(1, input.afterDetailViews)) return false;
  return !inDismissCooldown(input.dismissedAtMs, input.cooldownDays, input.nowMs);
}
