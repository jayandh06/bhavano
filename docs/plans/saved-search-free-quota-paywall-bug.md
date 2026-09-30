# /saved-searches showed a paywall to everyone — the free quota was never wired to the page

## Status: fixed 2026-09-30

## Report

User asked where to click to save a search; walked through to `/saved-searches`, and reported not
seeing the "+ New saved search" button at all.

## Root cause (verified against production data)

`SavedSearchesService.create()` has supported a free quota (2 alerts/user, admin-configurable via
`SavedSearchSetting`) for some time — its own doc comment says plainly: *"This used to be Plus-only,
which made the whole feature unusable: there have never been any Plus subscribers, so a built alert
system had zero rows."* That fix landed in the service. **`apps/web/src/app/saved-searches/page.tsx`
was never updated to match** — `SavedSearchesGate` still checked `profile.premiumUntil` alone and
showed a hard "Bhavano Plus required" paywall to anyone who wasn't already subscribed, before ever
rendering the form.

Confirmed live: **0 users currently have an active Plus subscription** — so 100% of visitors to that
page hit the paywall. All 56 existing `SavedSearch` rows have `source = 'free'`, none `'plus'`,
confirming every one of them came from the automatic requirement-capture path (an empty search
creating one in the background), never through this page — because the page never let anyone
through to try it manually.

## Fix

- New endpoint `GET /saved-searches/allowance` (`SavedSearchAllowanceDto`: `canCreate`, `source`,
  `freeRemaining`) — a thin wrapper over the existing `alertAllowance()`, so the page can ask the
  same question the backend already answers correctly instead of only checking subscription status.
- `SavedSearchesGate` now shows the create form whenever `canCreate` is true (free slot **or** Plus),
  and only shows the upgrade prompt when neither is available — copy corrected from "this is a Plus
  benefit" to "you've used your free alerts."
- `SavedSearchesManager` shows "N free alerts left" when the next one would come from the free quota,
  so the limit is honest rather than a surprise on the third attempt.

Verified against production: 10 users have already used both free slots and correctly still see the
upgrade prompt; everyone else now reaches the working "+ New saved search" button for the first time.

## Why this matters right now

`Metro-Seeker Intent` (paused, built 2026-09-30) is aimed at exactly this action. Before this fix, a
seeker who clicked the ad, searched, and tried to save it would have hit a paywall on their very
first try — not the free action the product was designed to offer.
