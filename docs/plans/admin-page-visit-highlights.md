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
- No filter yet ("show only buyers"); the highlight is visual. A filter would need these conditions in the visit query itself.
- A visit by a buyer who logged in on an earlier session only (not this one) is not marked: the link is the login in that session.
- The same colours could go on the Campaign analytics rows; not asked for.
