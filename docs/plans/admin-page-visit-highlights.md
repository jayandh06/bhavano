# Admin Page visits: highlight buyers, posters and featured ads (2026-11-01)

Asked for: make it easy to spot, among the Page visits rows, the visits that led to a posted ad (live or on its way to
live), a featured listing, a user who has bought at least once, and a user who holds something paid right now.

## What shows
Each row on `/page-visits` gets a left-edge colour and tint, plus small badges under the time. A row takes the colour of the most
valuable thing about it (order below); every applicable badge still shows. A legend sits above the table.

| Highlight | Colour | Rule |
|---|---|---|
| Active purchase | strong green | any account that logged in during the session holds a paid product now: an unexpired `UserSubscription`, or a listing they own with `boostedUntil` or `instantAlertsUntil` in the future |
| Purchased | light green | any account that logged in during the session has a `Payment` with status `paid`, ever |
| Featured | gold | a listing created in this session (`Listing.createSessionId`) has a `ListingBoost`. "Featured now" while `boostedUntil` is in the future, "Featured (ended)" after |
| Ad posted | blue | a listing created in this session is live (`publishState` live, status active, not expired) = "Ad live"; or `pending_checkout` / `scheduled` = "Ad in pipeline". Sold, deactivated, expired and `awaiting_claim` listings are not marked |

## Two scopes, on purpose
- **Ad and Featured are about the session**: they use the listing's `createSessionId`, so only the visit in which the ad was posted lights up.
- **Purchased and Active purchase are about the person**: they follow the account (`Visit.userId` plus every `LoginEvent` for the session), so
  every visit by a buyer shows it, including earlier visits that happened before they paid and ones logged in later.

## Where
- Rules and tests: `apps/bff/src/admin/page-visit-highlights.ts` and `.spec.ts`.
- Data: `AdminService.pageVisitHighlights` runs four small queries for the page of rows on screen (listings with a boost count, paid payments
  grouped by user, active subscriptions, owned listings with a running boost or instant alerts). `PageVisitDto.highlights` carries the result;
  the single-session trail does not.
- UI: `apps/admin/src/components/PageVisitsTable.tsx` (`PageVisitLegend`, row styles) and `apps/admin/src/app/page-visits/page.tsx`.

## Not done
- A visit by a buyer who logged in on an earlier session only (not this one) is not marked: the link is the login in that session.
- The same colours could go on the Campaign analytics rows; not asked for.

## Filter (added 2026-11-01)
A "Highlights" dropdown in the filter bar keeps only the matching visits: All visits, Highlighted only (any of the four), Ad posted (live or pending),
Featured listing, Has purchased, Active purchase now. It is `highlight` on `GET /admin/page-visits` (`ListPageVisitsDto`), turned into a Visit
`where` by `AdminService.highlightWhere`, which asks the database the same four questions as the row colours:
- Ad posted: sessions with a listing that is live and unexpired, or `pending_checkout` / `scheduled`.
- Featured: sessions with a listing that has any `ListingBoost`.
- Purchased / Active purchase: the matching accounts, plus the sessions they logged in during (Visit.userId or any LoginEvent), so a buyer's visits all show.
  When no account qualifies the filter returns nothing, not everything.
- The helpers `usersWithPurchase` and `usersWithActivePurchase` are shared with the row colours, so the two cannot disagree.
Tests: `page-visit-highlight-filter.spec.ts`. The date range still applies (default one day), so widen it to find older buyers.

## Group by user (added 2026-11-01)
Asked after seeing one buyer on two rows: the same person opened the mobile app twice, which is two sessions (one `Visit` row each). A "View" dropdown
now offers **Group by user**; the default stays one row per session. We did **not** merge by IP: a mobile carrier or an office shares one public IP
across many people, so that would join strangers' trails.
- **Rule:** visits are grouped by `Visit.userId`. A visit nobody logged in on stays a row of its own (nothing ties it to a person).
- **Row:** the first session's source, campaign, device, landing page and IP (how the person arrived); started at the first session's start; last
  active at the newest session's; pages added up; "N sessions" under the time; highlights merged (strongest ad and featured state, any purchase flag);
  logins de-duplicated. Opening the row shows every session's page views as one trail in time order.
- **Paging and order:** by group, newest activity first; column sorting is off in this view. Grouping happens in memory over the newest 5,000 matching
  visits (`PAGE_VISIT_GROUP_SCAN_CAP`); when the range holds more, the page says the oldest were left out, so narrow the dates.
- **Where:** `apps/bff/src/admin/page-visit-groups.ts` (rules, tested in `page-visit-groups.spec.ts`), `AdminService.listPageVisitsGrouped` and
  `buildPageVisitItems`, `groupBy=user` on the list API, `PageVisitDto.groupedSessionIds`, and `PageVisitsTable.tsx` for the row and combined trail.
- **Not done:** session boundaries inside the combined trail (it is one time-ordered list); grouping by a logged-out visitor's cookie across sessions.
