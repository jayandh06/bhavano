# Admin campaign analytics: where visitors come from, and what they did

Requested 2026-10-24. Plan only; nothing is built. An admin page that shows how many visits come from
each campaign, ad group and ad, whether they converted, whether the conversion was paid (an ad click,
and/or money received), plus whatever else the data we already hold can answer.

## What we already record (so most of this needs no new tracking)
| Fact | Where | Notes |
|---|---|---|
| A session's source, medium, campaign, `gclid`, `campaignId`, `adGroupId`, `adId`, landing path, device, OS, IP city, bot flag, JS-confirmed | `Visit` (one row per session) | `campaignId`/`adGroupId` have names in `apps/bff/src/ads/campaign-names.ts`. Landing path only, no query (see below). |
| Every page of the session, with its filters since 2026-10-24 | `PageView` (+ `query`) | Gives engagement, `/post` steps, the funnel. |
| Who the session became | `Visit.userId`, filled when that session logs in | Existing users who log in also set it. |
| First-ever touch of a person | `User.acquisition*` (source, medium, campaign, gclid, campaignId, adGroupId, adId) | A 30-day cookie, first touch across sessions. App installs fill it from the Play install referrer. |
| An ad posted, and from which session | `Listing.createSessionId` | Ties a listing to the exact `Visit`. |
| Money received | `Payment` (purpose, amount, `paidAt`, platform, provider) | Boosts, publish fees, subscriptions, credit packs, Apple purchases. Linked to a person, not a session. |
| Searches | `SearchEvent` | Demand by campaign if joined on session. |
| What Google was told | `GoogleAdsConversionProvider` uploads (registration, post-ad success, purchases) | Not stored: there is no record of what was uploaded or whether it worked. |

## Gaps that limit the analysis (fix as part of the work)
1. **No cost or click data.** Spend, clicks and impressions live only in Google Ads. Without them there is no CPA, ROAS or "clicks that never became a visit". Fix: a nightly import from the Ads API into a daily stats table.
2. **Landing page has no filters.** `Visit.landingPath` is the path only. `PageView.query` now holds the filters for every page, including the first, so the landing page's filters can be read from the session's first `PageView`.
3. **No keyword.** The Final URL suffix carries campaign, ad group, ad and `gclid`, not the search term. Adding `keyword={keyword}`, `matchtype={matchtype}`, `network={network}` and `device={device}` to the suffix and capturing them would add keyword-level analysis. (Search terms themselves come from the Ads API, not the click.)
4. **No upload log.** A small `ConversionEvent` table (person, session, kind, value, sent at, result) would show which conversions reached Google, and stop double sends.
5. **Payments are not tied to a session.** Link a payment to the visit by person plus time (see attribution below).

## Definitions (decide these first)
- **Real visit:** not a bot (`isBot` is not true), and ideally JS-confirmed. Everything else is shown separately as bot or unconfirmed traffic, so the bot share per campaign is visible.
- **Converted** is a funnel, not one yes/no, so each step is its own column:
  1. real visit → 2. engaged (2+ pages, or a listing opened, or a search) → 3. reached `/post` → 4. signed up (a new account created in or after that session) → 5. posted an ad → 6. paid (any `Payment` paid) → revenue.
- **Paid conversion** has two meanings, both shown: (a) the visit came from a paid ad click (`gclid` present, or `medium = cpc`), and (b) money was received (a paid `Payment`). Revenue is summed per campaign.
- **Attribution model** (a selector, because each answers a different question):
  - *Same session:* the conversion happened in the visit that came from the campaign.
  - *First touch:* the person's `User.acquisition*`.
  - *Last paid click within N days:* the person's most recent visit with a `gclid` before the conversion (default 30 days).
- **Cohort view:** of the visits that arrived in a period, what share converted within 1 / 7 / 30 days.

## The pages
1. **Overview** (`/analytics`): channel table (paid search, organic search, direct, referral, social, app), a daily trend, totals for the funnel.
2. **Campaigns** (`/analytics/campaigns`): campaign → ad group → ad drill-down, with names. Columns: visits, real visits, bot %, engaged %, reached `/post`, signed up, posted, paid, revenue, and later cost, CPC, CPA, ROAS.
3. **Landing pages** (`/analytics/landing`): conversion by landing path and filters (`/rent-lease`, `/buy`, area pages), best and worst, so the Ads final URLs can be tuned.
4. **Conversions** (`/analytics/conversions`): a list of people who converted, with campaign, ad group, landing page, time from click to conversion, value, and whether it was uploaded to Google.
5. **Visitor drill-down:** every row links to the existing Page visits session.

Slicers on all: date range, platform (web / app), device, city (from IP), new vs returning, attribution model, include or exclude bots.

## More the data can answer
- Time from first click to sign-up, and to first post or purchase.
- Clicks that never became a visit (page speed, ad blockers, wrong URL), once clicks are imported.
- Repeat clickers and existing users who clicked an ad again (the "paid clicks from existing users" problem, from `Visit.userId`).
- Which city and device convert; which landing page each ad group should point to.
- Organic and referral sources that bring posters, not only ad traffic.
- Search demand by campaign (`SearchEvent` joined on session).
- Daily anomaly flags: a campaign with spend and zero real visits, or a spike in bots.

## Build order
| Phase | What | Needs |
|---|---|---|
| 1 | BFF aggregation endpoint and the Campaigns page: visits through revenue by campaign / ad group / ad, same-session and first-touch, date range, platform | No schema change. SQL joins `Visit` to `User`, `Listing.createSessionId` and `Payment`. |
| 2 | Overview and Landing pages, cohorts, new vs returning, bot quality, last-paid-click model | Reads the first `PageView` of each session. |
| 3 | Ads cost import, CPA / ROAS, click-to-visit gap, `ConversionEvent` log and upload status | New tables and a nightly job. |
| 4 | Keyword and ValueTrack capture, daily alerts, CSV export | Ads URL suffix change and a small middleware change. |

## Scale and privacy
- Volume is small (about 165,000 page views a month), so plain SQL aggregation is fine; no summary tables are needed until it is a hundred times larger.
- Admin-only. It uses data we already hold (IP city, not the IP address). No new personal data is collected in phases 1 to 3.
- Phase 4's keyword capture adds search terms to the visit record; mention in the privacy text if kept.

## Decisions needed
1. Default attribution model: same session, first touch, or last paid click in 30 days?
2. Does "converted" mean sign-up, a posted ad, or a payment, or all three shown side by side (proposed)?
3. Is cost and ROAS wanted now (phase 3 early) or after the funnel page?
4. Should bots appear in the numbers by default, or be hidden with a toggle (proposed: hidden, with a toggle)?

## Built: phase 1 (2026-10-24)
Requirement added by the owner: the page works by **date range, with sorting and filtering**. Decisions
taken to ship it (all changeable): bots hidden by default with a Traffic filter; conversion steps shown
side by side; attribution by **same session** only (first touch and last paid click are phase 2).

- **Page:** Admin → Analytics → *Campaign analytics* (`/analytics/campaigns`).
- **Date range:** IST date pickers with 1 / 7 / 15 / 30 day presets, default 7 days.
- **Group by:** campaign, ad group, ad, source / medium, or landing page. Campaign and ad group rows
  are links that drill down (campaign to its ad groups, ad group to its ads); a banner shows the
  drill-down with a way back.
- **Filters:** traffic (humans, JS-confirmed, everything, crawlers, unclassified), platform (website /
  app), device, arrived from (paid ad clicks / not from an ad), conversions (rows with or without
  one), a name-or-id search, and a minimum number of visits.
- **Sorting:** every column, ascending or descending, including the three percentages (sign-up,
  posted, paid, each of visits). Default: visits, largest first.
- **Columns:** visits, bots, engaged (2+ pages), reached `/post`, sign-ups, ads posted, paid,
  revenue (rupees), and the three rates. A totals row covers every matching row, not only those shown.
- **Rows without a campaign id** appear by source (`google / organic`, `direct / none`, `google-play /
  organic`) so non-ad traffic is visible next to the campaigns.
- **Code:** `GET /admin/analytics/campaigns` (`apps/bff/src/campaign-analytics`, one parameterised SQL
  query plus in-memory sort and filter), shared types in `@bhavano/types/campaignAnalytics`, the page
  in `apps/admin/src/app/analytics/campaigns`.
- **Counting rules:** a session counts as a sign-up when the person's account was created within 24
  hours of the session starting; as paid when that person had a paid `Payment` within 24 hours of it;
  as posted when a listing's `createSessionId` is the session. Engaged and reached-`/post` come from
  that session's `PageView` rows.
- **Checked:** unit tests for the query shape and the sort, filter and totals logic; the SQL was run
  against a throwaway Postgres with the real schema and sample rows (campaign, ad group, source,
  landing, platform and traffic splits all gave the expected counts).

Not yet: first-touch and last-paid-click models, cohorts, ad cost and clicks, the conversion upload
log, keywords (phases 2 to 4 above).
