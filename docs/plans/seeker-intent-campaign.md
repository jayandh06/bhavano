# A first seeker-intent Google Ads campaign (pilot)

## Status: built 2026-09-30, PAUSED — not yet reviewed/enabled by the owner

**Update (observed 2026-10-04, see [`google-ads-keyword-audit-2026-10.md`](google-ads-keyword-audit-2026-10.md)):**
the campaign is now **ENABLED**; Kolkata Buy/Rent ad groups were added 2026-10-01; and on
2026-10-04 it was moved, with all 8 poster campaigns, onto the shared portfolio
`Bhavano-TargetCPA` (₹75 target) — not the standalone goal/bidding described below. First week:
₹1,386, 56 clicks, 0 saved searches, 1 "Post ad success".

Built exactly as sketched below, plus the 14 seeker-bycatch keywords paused in the existing poster
campaigns (see "Bycatch removed from poster campaigns" at the end). Nothing spends until the
campaign is switched to Enabled in the Ads UI.

**What exists now:**
- Campaign `Metro-Seeker Intent` (id `24297610212`), Search, **PAUSED**, budget ₹350/day
  (`campaignBudgets/15906321326`, not shared), bidding Maximize Conversions, targeting Bengaluru +
  Pune only, language English — matches the existing Metro campaigns' network settings exactly.
- 4 ad groups, one landing page each, real existing pages (no new page work needed):
  `bengaluru/rent-lease`, `bengaluru/buy`, `pune/rent-lease`, `pune/buy`.
- 32 keywords (phrase match, ~8 per ad group, all city-specific — the earlier draft's two
  city-agnostic "near me" keywords were dropped before creation: duplicating them across the
  Bengaluru and Pune ad groups in the same campaign risked Google showing a Bengaluru searcher the
  Pune-worded ad, so each keyword now names its own city instead).
- 4 responsive search ads (11 headlines + 3 descriptions each), search/browse language only, no
  posting language anywhere in this campaign's copy. Policy review shows "unknown" immediately
  after creation — normal for a paused campaign; re-check once enabled.
- Conversion goal: no per-campaign goal config was set — checked first, and unnecessary. "Save a
  search" is already `primary_for_goal = true` account-wide (verified read-back), so Maximize
  Conversions already considers it without any extra setup. It also has 0 real volume in the poster
  campaigns today, so leaving the account-wide default in place doesn't dilute their bidding either.

**GTM verification: done, passed (2026-09-30).** Checked directly against the live Tag Manager
container via the API (`gtm_check_save_search.py`, read-only) rather than a manual Preview
click-through: the "CE - save_search" trigger matches the exact event name the code pushes
(`{{_event}} equals "save_search"`), the "Ads - save_search" tag is wired to fire on that trigger
(confirmed by trigger id, not just name), the tag is not paused, and all of this is true in the
**currently published, live** container version (version 9), not just an unpublished draft. "Save a
search" showing 0 Google Ads conversions in 3 months is confirmed to be exactly what it looked like:
no ad has ever sent seeker traffic to it, not a broken pipeline. Nothing left blocking enabling the
campaign on this front.

## Original sketch

Follows [`google-ads-performance-analysis-2026-09.md`](google-ads-performance-analysis-2026-09.md):
every existing campaign targets posters (owners/agents who want to list), confirmed against all 304
enabled keywords. This is a small, separate pilot for the other side of the marketplace — people
searching to rent or buy — rather than folding seeker keywords into the poster campaigns (mixing
intent in one campaign was considered and rejected: same ad/landing page can't serve both audiences,
Smart Bidding can't tell a good seeker click from a bad one without its own goal, and it destroys the
ability to measure either side separately — see the reasoning already written up in chat).

## Why now, not "generic"

"Metro-Generic Post Ad Intent" was considered as the thing to repurpose. Checked and rejected: it's
one of the account's best campaigns (14-day CPA ₹102, CTR 9.9%, 99 conversions from ~₹10k), and its
keywords are entirely poster searches ("free property ads posting sites," "post free ad for rent") —
not vague, just intent that doesn't split by sell/rent/lease. Repurposing it would trade a proven
campaign for an unproven one.

## What already exists (no new product work needed)

- **Landing pages**: `/<city>/<buy|rent-lease>/<category>` already exists and is the SEO-preferred
  URL for these pages (`apps/web/src/app/[city]/[[...rest]]/page.tsx`) — a seeker ad can land
  directly on real, relevant results (e.g. `/bengaluru/rent-lease/apartment`), not the home page.
- **A seeker "conversion" already has a tracked action**: "Save a search" (Google Ads conversion
  action, category Submit lead form) with a client-side `save_search` dataLayer event
  (`SavedSearchesManager.tsx`), documented to be wired to it via GTM
  (`consolidate-analytics-and-ads-on-gtm.md`). It has **0 conversions in the last 3 months** — but
  that's fully explained by there being no seeker ad traffic to trigger it yet, not evidence it's
  broken. **Must be verified with a real test click before spending real budget** — the GTM doc's
  own Step 5 checklist (Preview mode, save a search, confirm the tag fires) was written for exactly
  this and should be re-run first, since GTM container config lives outside this codebase and can't
  be confirmed by reading it.
- **Real organic seeker activity already happens, for free**: 56 saved searches and 66 requirement
  captures ("didn't find it, tell us what you want") in the last 14 days alone, all from organic/
  direct traffic. There's a real audience already doing the thing we'd pay to encourage — this
  pilot is pointing budget at behavior we know exists, not guessing at it.

## Proposed pilot

- **New, standalone Search campaign** — e.g. `Metro-Seeker Intent`. Own budget, own ad groups, own
  landing pages. Never merged into or sharing an ad group with a poster campaign.
- **Cities**: start with Bengaluru and Pune only — the two cheapest, best-converting cities in the
  account (₹74–80 poster CPA) — rather than all 6 metros, to keep the pilot small and its result
  readable. Expand only if it works.
- **Budget**: ~₹300–400/day (≈10% of current total spend), for 2–4 weeks. Small on purpose: this is
  unproven, unlike the poster campaigns which have a year of signal behind the current budgets.
- **Conversion goal — campaign-specific, not account-wide default.** Set this campaign to use a
  *campaign-specific* conversion goal set containing only "Save a search" (Google Ads supports this
  per-campaign). This is important: leaving it on the account's shared default goal set would also
  make poster campaigns bid partly toward "Save a search," which they should never do, and would let
  this campaign's Smart Bidding chase whatever the shared set happens to contain instead of the one
  action that actually matters for seekers.
- **Bidding**: Maximize Conversions, no target CPA at first — there's no historical seeker CPA to
  target against yet. Revisit once the campaign has real conversion volume (recommendation 3's usual
  ~30-conversion/month rule of thumb applies before trusting an automated target).
- **Ad copy**: search/browse language, never posting language — "Find Verified Rentals Near You,"
  "Browse Homes For Rent," "See New Listings Daily," CTA "Search now." No mention of posting, free
  listing, or "sell/list" anywhere in this campaign's copy.
- **Keywords** (phrase match to start, reviewed against search terms weekly exactly as the poster
  campaigns are): "2bhk for rent in bengaluru," "flat for rent in bengaluru," "apartment for rent
  near me" *(scoped to these two cities via location targeting, not literally spelled out per
  keyword)*, "house for rent in pune," "pg for rent in bengaluru," "flat for sale in bengaluru,"
  "2bhk for sale in pune," "apartments for sale near me," "plots for sale in bengaluru." No
  competitor brand terms (99acres, magicbricks, nobroker, housing.com) in this first pass — bidding
  on competitor names is a separate, more aggressive decision to make deliberately later, not a
  default.
- **Landing page per ad group**: match the query's city + transaction + category to the matching
  `/<city>/<buy|rent-lease>/<category>` page, not the home page.

## How to judge the pilot after 2–4 weeks

Google's own "Conversions" number (Save a search) is the leading indicator, but the real question is
whether seekers who arrive actually do anything for the marketplace — check our own database:
- Save-a-search rate per click (some engagement here is a reasonable pass/fail bar; a portal with no
  saved searches at all from real seeker clicks means the audience or the landing pages are wrong).
- Requirement captures from this traffic (a seeker who searched, found nothing, and left a request —
  the strongest unmet-demand signal, already surfaced to owners via `RequirementMatchJob`).
- Messages sent to sellers by users acquired through this campaign — this is the actual fix for the
  finding in the earlier analysis that only 34% of listings get any enquiry at all.
- Cost per saved-search / per requirement, compared honestly against what a poster-side ₹ buys today
  (~₹300 per poster) — these are different currencies (a seeker isn't a poster), so this is about
  whether the number is sane, not directly comparable.

## Not doing (for this pilot)

- Not touching any poster campaign's budget, keywords, or ad groups.
- Not bidding on competitor brand names yet.
- Not building a new landing page or a new BFF/Ads conversion action — reusing what exists.
- Not setting a target CPA until there's real conversion volume to base one on.

## Bycatch removed from poster campaigns (2026-09-30)

Paused (not deleted — reversible) 14 keyword instances across the existing poster campaigns that
were catching real seekers by accident, confirmed against the full 304-keyword list:

| Keyword | Paused in |
|---|---|
| shops for rent near me | Metro-Rent Out Property (Owners), Other-Metro-Rent Out Property (Owners) |
| house in rent near me | same two campaigns |
| flat in rent near me | same two campaigns |
| coliving pg near me | same two campaigns |
| co living pg near me | same two campaigns |
| colive pg near me | same two campaigns |
| coworking space near me | Metro-Generic Post Ad Intent, Other-Metro-Generic Post Ad Intent |

Not touched: "rent a bed" / "rent a couch" / "furniture rental near me" — these live in the "Rent
out Furniture" ad group, already paused entirely on 2026-09-28 for the same reason. "sell 3bhk flat"
/ "sell 2bhk online" and "free rent ads posting sites" / "property rent advertise free" were
considered and left alone: they matched the flagging pattern (digits, or "rent a" as a substring of
"rent ads"/"rent advertise") but read as genuine owner/poster intent, not seeker bycatch.
