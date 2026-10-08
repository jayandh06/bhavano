/** Expected revenue per self-serve poster, by category (and transactionType where there's
 * enough data), for the "Post ad success" conversion value — see
 * docs/plans/server-side-google-ads-conversion-upload.md's "Phase 2: conversion value" section
 * for the full model. Value is attributable revenue within 7 days of a user's *first* post
 * (confirmed live 2026-10-08: median post-to-payment latency is 0 days, 98% within 7 — purchases
 * happen in the same posting session, not weeks later), averaged across every poster in the
 * segment, payers and non-payers alike — that average-over-everyone is what makes this an
 * expected value rather than an average purchase size.
 *
 * Static, not a live query, on purpose — same reasoning as campaign-names.ts: this account's
 * purchase volume is still small (41 paid payments across 337 posters as of 2026-10-08), so an
 * unattended recompute would just chase noise week to week. A human should look at the new
 * numbers before they go live. Regenerate by re-running the Phase 1 analysis (category x
 * transactionType posters/payers/revenue within a 7-day window, grouping self-serve
 * (source IN [direct, google_api], createdByAdminId null) listings by owner's first post) once
 * there's meaningfully more data — the ~30/month trust threshold already used elsewhere in this
 * account's bidding decisions is the right bar to wait for before trusting a refresh.
 *
 * Deliberately *not* segmented by city — city x category x transactionType was tried first and
 * only 3 of 150 possible segments cleared even a 10-poster minimum. category x transactionType
 * is the finest level this account's current volume actually supports. */

/** `${category}|${transactionType}` -> ₹ value per poster. Only combinations with >= 10 posters
 * in the 2026-10-08 analysis — thinner ones fall back to POST_AD_VALUE_BY_CATEGORY or the
 * account-wide average below. */
const POST_AD_VALUE_BY_SEGMENT: Record<string, number> = {
  'plot|sell': 2339,
  'house|rent': 1743,
  'commercial|rent': 1268,
  'apartment|sell': 1113,
  'apartment|rent': 1112,
  'pg|rent': 659,
  'house|sell': 190,
  // A real, confirmed zero (10 posters, 0 payers) — not a thin-data placeholder. Matches this
  // category getting zero ad impressions too (see docs/plans/google-ads-keyword-audit-2026-10.md)
  // — two independent signals agreeing this category isn't working right now, not one noisy one.
  'villa|rent': 0,
};

/** category -> ₹ value per poster, pooled across transaction types. Fallback for a
 * category|transactionType combination too thin to trust on its own (e.g. "commercial|sell" had
 * only 4 posters — falls back to "commercial" here, which had 41). */
const POST_AD_VALUE_BY_CATEGORY: Record<string, number> = {
  plot: 2339,
  commercial: 2288,
  house: 1223,
  apartment: 1183,
  pg: 659,
  villa: 0,
};

/** Final fallback — every self-serve poster, every category, pooled. 337 posters, 39 payers,
 * ₹477,000 within 7 days of first post, as of 2026-10-08. */
const POST_AD_VALUE_ACCOUNT_WIDE = 1415;

/** Rupees — matches `UploadClickConversionInput.value`'s own convention (never paise). */
export function postAdValueRupees(category: string, transactionType: string): number {
  return (
    POST_AD_VALUE_BY_SEGMENT[`${category}|${transactionType}`] ??
    POST_AD_VALUE_BY_CATEGORY[category] ??
    POST_AD_VALUE_ACCOUNT_WIDE
  );
}
