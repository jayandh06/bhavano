"use strict";
/**
 * When the dismissible login ask on listing detail may appear — shared by web and app so both
 * read the admin settings the same way. The listing itself is never gated; see
 * docs/plans/listing-detail-login-nudge.md for why each web rule exists (search rankings and
 * Google Ads landing-page experience).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WEB_PROMPT_MIN_DETAIL_VIEWS = void 0;
exports.classifyVisitEntry = classifyVisitEntry;
exports.rolloutBucket = rolloutBucket;
exports.inDismissCooldown = inDismissCooldown;
exports.shouldShowWebLoginPrompt = shouldShowWebLoginPrompt;
exports.shouldShowAppLoginPrompt = shouldShowAppLoginPrompt;
const AD_CLICK_PARAMS = ["gclid", "gbraid", "wbraid", "msclkid", "fbclid"];
const PAID_MEDIUMS = new Set(["cpc", "ppc", "paid", "paidsearch", "paid_search", "paid-social", "paidsocial"]);
const SEARCH_ENGINE_HOST = /(^|\.)(google|bing|yahoo|duckduckgo|yandex|baidu|ecosia|search\.brave)\.[a-z.]+$/i;
/** Query parameters as a plain map. Hand-parsed because this package has no DOM types, and so no
 * URLSearchParams. */
function queryParams(search) {
    const params = new Map();
    for (const pair of search.replace(/^\?/, "").split("&")) {
        if (!pair)
            continue;
        const [rawKey, rawValue = ""] = pair.split("=");
        try {
            params.set(decodeURIComponent(rawKey), decodeURIComponent(rawValue.replace(/\+/g, " ")));
        }
        catch {
            // Malformed escape: skip the pair.
        }
    }
    return params;
}
/** Classifies the first page of a visit from its query string and `document.referrer`. */
function classifyVisitEntry(search, referrer) {
    const params = queryParams(search);
    if (AD_CLICK_PARAMS.some((p) => params.has(p)))
        return "ad";
    const medium = params.get("utm_medium")?.toLowerCase();
    if (medium && PAID_MEDIUMS.has(medium))
        return "ad";
    const host = /^[a-z][a-z0-9+.-]*:\/\/([^/?#:]+)/i.exec(referrer)?.[1];
    if (host && SEARCH_ENGINE_HOST.test(host))
        return "search";
    return "other";
}
/** Stable 0–99 bucket for a viewer key, so the same visitor stays in or out of a rollout. */
function rolloutBucket(viewerKey) {
    let hash = 0;
    for (let i = 0; i < viewerKey.length; i++)
        hash = (hash * 31 + viewerKey.charCodeAt(i)) >>> 0;
    return hash % 100;
}
function inDismissCooldown(dismissedAtMs, cooldownDays, nowMs) {
    return dismissedAtMs != null && nowMs - dismissedAtMs < cooldownDays * 86_400_000;
}
/** Hard floor on the web: the card never shows on the first listing of a visit, whatever the
 * setting says, so a visitor arriving from search or an ad never gets it on their landing page. */
exports.WEB_PROMPT_MIN_DETAIL_VIEWS = 2;
function shouldShowWebLoginPrompt(input) {
    if (!input.enabled || input.shownThisSession)
        return false;
    if (input.detailViewsThisSession < Math.max(exports.WEB_PROMPT_MIN_DETAIL_VIEWS, input.afterDetailViews))
        return false;
    if (input.excludeAdAndSearchLanding && input.visitEntry !== "other")
        return false;
    if (rolloutBucket(input.viewerKey) >= input.rolloutPercent)
        return false;
    return !inDismissCooldown(input.dismissedAtMs, input.cooldownDays, input.nowMs);
}
function shouldShowAppLoginPrompt(input) {
    if (!input.enabled)
        return false;
    if (input.detailViews < Math.max(1, input.afterDetailViews))
        return false;
    return !inDismissCooldown(input.dismissedAtMs, input.cooldownDays, input.nowMs);
}
