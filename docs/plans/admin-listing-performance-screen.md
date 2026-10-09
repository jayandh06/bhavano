# Admin: "Listing performance" screen

## Context

Admin currently has no single screen answering "how is this listing actually doing" — engagement
signals (views, enquiries, messages, favourites) are scattered across the main Listings dashboard
(a few columns) and a per-listing detail drill-down (`listEngagement`), with no way to see them
together across many listings, filtered by city/area/date. This adds a dedicated screen for that,
reusing every existing convention this codebase already has for admin list screens (City/Area
cascading filter, `DateRangeFilter`, sortable columns, pagination) rather than inventing new ones.

**Confirmed scope decisions** (asked and answered before writing this plan):
- **Date range = listings posted in that window** (`Listing.createdAt`), not "activity that
  happened in that window." Every stat shown is that listing's lifetime total — matches how every
  other admin screen's date filter already works (e.g. the main Listings page's `createdFrom`/
  `createdTo`). The alternative (bounding views/messages themselves by date, for any listing
  regardless of post date) would need a new index on `ListingView` and meaningfully more complex
  queries for a true "activity in this window" report — not what was asked for here.
- **"Message Reply" = a rate, not a count**: "owner replied in N of M enquiry threads" per listing,
  not a raw count of the owner's own messages.

## Stats shown (one row per listing)

| Column | Source | Sortable? |
|---|---|---|
| Views (total) | `Listing.viewCount` | Yes |
| Views — organic/unique | `Listing.uniqueViewerCount` (already called `organicViewCount` elsewhere in admin — same number, same name) | Yes |
| Views — logged-in / anonymous | `ListingView` split by `viewerKey` prefix (`user:`/`anon:`), per-page `groupBy` | **No** |
| Enquiries | Count of `type:'inquiry'` `Conversation` rows (same concept as the main dashboard's `messageCount`, relabeled) | Yes (relation count) |
| Total messages | `Message` count across those enquiry threads | **No** |
| Messages from unique users | Distinct `Message.senderId` across those threads | **No** |
| Message reply rate | "N of M": threads where the owner sent ≥1 message, of total enquiry threads | **No** |
| Favourites | `Listing.likeCount` | Yes |
| Contact reveals | `ContactReveal` — **free relation count** (`Listing.contactReveals`, confirmed in schema), same mechanism as enquiries | Yes (relation count) |
| Boosted | `Listing.boostedUntil` in the future — context for reading the other numbers (a boosted listing's views aren't organic), not a new metric | Yes |

Deliberately **not** included: `ListingInterest` ("I'm interested" taps — overlaps too much with
favourites/enquiries for this screen) and `instantAlertsActive` (operational/billing state, not a
performance stat). No title-search or category/transactionType filter either — out of scope as
asked (City/Area/Date range only); both would be trivial to add later since they're already columns
on the same `where` builder.

**Why the bottom four rows in the table above aren't sortable**: they're computed in-memory from a
page of rows already fetched (`Message` has no `listingId` — it's two hops from `Listing` via
`Conversation` — so there's no relation-count or indexed column Prisma can order the *main* query
by). Same accepted limitation this codebase already documents elsewhere (`AdminPageVisitSortField`'s
own comment: "No `pageViewCount` pair... can't be ordered on"). These columns get a plain `<th>`
header, no `SortableHeader`.

## Files

1. **`packages/types/src/index.ts`** — add, near `AdminListingRowDto`:
   ```ts
   export interface ListingPerformanceRowDto {
     id: string; title: string; cityName: string; area: string;
     category: ListingCategory; transactionType: TransactionType; createdAt: string;
     viewCount: number; organicViewCount: number;
     loggedInViews: number; anonymousViews: number;
     enquiryCount: number; totalMessages: number; uniqueMessageSenders: number; repliedThreads: number;
     likeCount: number; contactRevealCount: number;
     isBoosted: boolean; boostedUntil: string | null;
   }
   export interface ListingPerformancePage { items: ListingPerformanceRowDto[]; total: number; }
   ```
   (`repliedThreads` pairs with `enquiryCount` as the "N of M" — no separate `totalThreads` field;
   it would just be `enquiryCount` under a second name, risking the two drifting apart.)

2. **`apps/bff/src/admin/dto/list-listing-performance.dto.ts`** (new) — same shape as
   `list-admin-listings.dto.ts`: `cityId?`, `areaId?`, `createdFrom?`/`createdTo?`
   (`@IsDateString`), `sort?` (`@IsIn(LISTING_PERFORMANCE_SORT_VALUES)`), `offset?`,
   `limit: number = 25`. Export `LISTING_PERFORMANCE_SORT_VALUES` (`createdAt_asc/desc`,
   `title_asc/desc`, `category_asc/desc`, `transactionType_asc/desc`, `viewCount_asc/desc`,
   `organicViewCount_asc/desc`, `likeCount_asc/desc`, `enquiryCount_asc/desc`,
   `contactRevealCount_asc/desc`, `boosted_asc/desc`) and `ListingPerformanceSort` type.

3. **`apps/bff/src/listings/listings.service.ts`** — add `LISTING_PERFORMANCE_ORDER_BY` (reusing
   the existing `adminOrderBy`/`nullsLast` helpers already in this file) and
   `listPerformanceForAdmin(query)`, near `listForAdmin`/`listEngagement`:
   - Main query: `Prisma.ListingWhereInput` from `cityId`/`areaId`/`createdAt` range (same
     `...(x ? {x} : {})` spread style as `listForAdmin`), `findMany` with
     `include: { city: true, area: true, _count: { select: { conversations: { where: { type: 'inquiry' } }, contactReveals: true } } }`,
     `orderBy: LISTING_PERFORMANCE_ORDER_BY[sort ?? 'createdAt_desc']`, `skip`/`take`; paired with
     `listing.count({ where })` in the same `Promise.all`.
   - Batch 1 (view split, bounded to this page's listing ids — `pageIds = rows.map(r => r.id)`):
     two `listingView.groupBy({ by: ['listingId'], where: { listingId: { in: pageIds }, ... } })`
     calls — one unfiltered (total), one `viewerKey: { startsWith: 'user:' }` (logged-in).
     `anonymousViews = total - loggedIn` per listing. Both index-assisted via
     `@@index([listingId, viewerKey])`. Deliberately two independent counts from `ListingView`
     rather than `viewCount - loggedInViews`, so a drift between the denormalized `viewCount` and
     real `ListingView` rows (e.g. a bulk-imported listing) can never produce a negative
     `anonymousViews`.
   - Batch 2 (message stats, bounded to `pageIds`): `conversation.findMany({ where: { listingId: { in: pageIds }, type: 'inquiry' }, select: { id, listingId, posterId } })`, then
     `message.findMany({ where: { conversationId: { in: conversationIds } }, select: { conversationId, senderId } })`. In-memory aggregate per listing (via a `conversationId -> conversation` map): `totalMessages` (count), `uniqueMessageSenders` (distinct `senderId` set size), `repliedThreads` (count of conversations where any message's `senderId === conversation.posterId` — same check `MessagingService`'s `unreadByOwner` already uses). Bounded by this page's enquiry-thread volume, never a full-table scan — the one accepted cost is a listing with an unusually large number of threads making its own page proportionally heavier, not unbounded.

4. **`apps/bff/src/admin/admin.service.ts`** — thin delegate:
   `listListingPerformance(query) { return this.listingsService.listPerformanceForAdmin(query); }`
   (mirrors `listListings` → `listForAdmin`).

5. **`apps/bff/src/admin/admin.controller.ts`** — `@Get('listings/performance') listListingPerformance(@Query() query: ListListingPerformanceDto): Promise<ListingPerformancePage>`. Confirmed no
   route conflict: every existing `listings/:id/...` route needs a third segment, so
   `listings/performance` (two segments) never matches them.

6. **`apps/admin/src/lib/bff.ts`** — `ListingPerformanceSortField`/`Sort` types (mirroring
   `AdminListingSortField`), a `ListingPerformanceQuery` interface, and
   `fetchListingPerformance(accessToken, query)` using the generic `Object.entries(query)` loop +
   `authedBffFetch(..., { cache: "no-store" })` (the newer convention, same as `fetchPageVisits`).

7. **`apps/admin/src/app/listing-performance/page.tsx`** (new) — **one plain server component, no
   separate client table file** (unlike `PageVisitsTable.tsx`, there's no per-row interactive state
   here to isolate — every sortable header is already a dumb server-rendered link). `requireAdmin()`
   → read `cityId`/`areaId` via `str()`, `createdFrom`/`createdTo` defaulting to
   `daysAgoIST(30)`/`todayIST()` (see "default window" below) → fetch in parallel:
   `fetchListingPerformance(...)`, `fetchCities(undefined, true)`, and
   `cityId ? fetchAreas(cityId, undefined, true) : Promise.resolve([])` (exact pattern from the main
   Listings page) → top filter bar with City/Area `SearchableSelect` (`autoSubmit`,
   `resetFieldsOnChange={["areaId"]}` on City, `disabled={!cityId}` on Area) + `DateRangeFilter` →
   `<table>` with `SortableHeader` on the sortable columns, plain `<th>` on the four derived ones →
   `<tbody>` mapped inline from `result.items` → `<Pagination>`.

8. **`apps/admin/src/components/AdminNav.tsx`** — add
   `{ href: "/listing-performance", label: "Listing performance" }` to `NAV_LINKS`, next to
   `/page-visits`/`/post-funnel` (list position only — the array has no actual sub-grouping).

## Default date range: 30 days

`page-visits` (1 day) and `post-funnel` (7 days) default to short windows because both review
*recent activity volume*. This screen reviews **posted-listing performance over a stretch** — a
1-7 day cohort of newly-posted listings is too thin to say anything yet. 30 days via
`daysAgoIST(30)`/`todayIST()`, silent default (no `?from=`/`?to=` in the URL until changed),
matching the existing silent-default convention.

## Edge cases

- **Zero enquiries**: render the reply rate as "—" or "No enquiries yet", never "0 of 0" (reads as
  "owner never replies," which is wrong when there was nothing to reply to). Same for
  `totalMessages`/`uniqueMessageSenders` at zero.
- **Empty result set**: render the table with its header + filter controls still visible and an
  empty-state row, same as the main Listings table's own convention.
- **Page size**: standard `PAGE_SIZE_OPTIONS` (10/25/50/100), default 25 — this screen's batch
  queries scale with page size, so keep the existing `@Max(100)` cap rather than raising it.

## Verification

- `pnpm --filter bff exec tsc --noEmit`, `pnpm --filter admin exec tsc --noEmit` — clean.
- `pnpm --filter bff test` — add a unit test for `listPerformanceForAdmin` covering: the view-split
  math (logged-in + anonymous from independent `ListingView` groupBys, never negative), the
  message-aggregation (totalMessages/uniqueMessageSenders/repliedThreads from a small fixture of
  conversations+messages), and that `cityId`/`areaId`/date-range filters land in the `where` clause
  correctly (same assertion style as the existing `listForAdmin` spec block).
- Manually load `/listing-performance` in the running admin app: confirm City→Area cascading works,
  date-range presets/custom both submit correctly, each sortable column's `SortableHeader` toggles
  asc/desc, and a listing with zero enquiries shows the "—" treatment instead of "0 of 0".
