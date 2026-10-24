# Showing URL parameters in the Page visits trail

Requested 2026-10-24: the trail showed `/bengaluru/rent-lease` with no way to tell which filters the
visitor had on. `PageView` stored only `(sessionId, path)`; the middleware deliberately dropped the
query string, and the client-side logger only fired when the *path* changed, so a filter change on
the same page (a bedrooms chip, a price) was invisible.

## What changed
- **`PageView.query`** (nullable text, migration `20261024150000_pageview_query`): the cleaned query
  string. Old rows have none.
- **Cleaning** (`sanitizePageViewQuery`, `@bhavano/types/pageViewQuery`, run in the browser, in the
  middleware, and again on the BFF): drops ad click ids (`gclid`, `gbraid`, `wbraid`, `fbclid`…), campaign
  tags (`utm_*`, `campaignid`, `adgroupid`, `adid`; these live on the session's Visit already), the
  referral code (`ref`, which is a user id), token-like params (`token`, `code`, `otp`, `password`,
  `access_token`, `state`…), `app`, `rememberCity`, and framework params (anything starting `_`).
  Values are cut at 80 characters and the whole string at 300 on a whole pair. Nothing left means null.
- **Recording.** Full page loads: the middleware sends `request.nextUrl.search`. In-page navigation:
  `SoftNavPageViews` now watches the query string as well as the path (it is mounted in a `Suspense`
  boundary because it uses `useSearchParams`), so each filter change is one trail entry.
- **De-duplication** is per path *and* query: the same page with different filters is a new view;
  an identical repeat within two seconds is still dropped.
- **Admin** (Page visits, the session trail): each entry shows the path with its filters read as
  words (`/bengaluru/rent-lease?bedrooms=2&minPrice=15000`) and links to that exact filtered page.
  Event markers (`/post/action…`, `/get-app…`) keep their own encoding in the path and are unchanged.

## Not covered
- The app's screens (`SoftNavAppPageViews`) have no URL filters to record; this is the website.
- Rows from before this change show the path only.
- More trail rows: every filter tap is now an entry. Watch `PageView` growth; the table is not pruned.
- Search text typed in the box is stored in `q=` (it was already kept in `SearchEvent`), so the trail
  can show personal text. Admin-only, covered by the privacy policy's technical-data line.
