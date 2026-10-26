# Page-view bursts: debounce in the tracker, cap per session in the BFF

Status: built 2026-10-26. Related: [`analytics-bot-filtering-and-attribution.md`](analytics-bot-filtering-and-attribution.md).

## What was seen
Session `53f932e0` (anonymous, Android, Google ad click, 2026-10-26 10:31 IST) logged **405 page views in 12 minutes** with only 2 listings opened.
384 were the same results page, `/bengaluru/rent-lease`, with a different `?areas=` each time, up to 88 a minute (about 3 a second). That is
`AreaFilter.tsx` pushing a new URL for every checkbox tick, and `SoftNavPageViews` logging each one. No other session in 24 hours passed 150.

## Why the hourly limit did not apply
The 20-an-hour "view limit" in Admin → Settings → Rate limits is `RateLimitService.checkAndRecordHit`, which is keyed by **user id**: it covers logged-in
users on the endpoints that carry the rate-limit guard. An anonymous visitor is not covered, and a results page re-rendered with a new filter is not a listing view
(`ListingView` was 0 for this session).

## What changed
- **Web tracker** (`SoftNavPageViews.tsx`): a new page is logged at once; a change that is only the query string waits for 1.5 s without another change and
  logs the last state once.
- **BFF** (`AnalyticsService.recordPageView`): a session may log 30 page views in any minute; further ones are dropped (not stored), counted from the views
  let through, so a slower session is under the cap again within a minute. In memory, one process; a restart forgets the window.
- Not changed: the area filter still pushes a URL per tick, so the server still renders the results page for each. Applying the selection after a short pause
  (or an Apply button) would fix that load; it changes how the filter feels, so it needs a decision.
- Not changed: `?areas=` carries database ids, against the URL rules in `.claude/CLAUDE.md` (see the comment in `AreaFilter.tsx`).
