# Lightweight, lazy-loaded admin screens: Listings, Page visits, Recent logins

## Status: implemented (2026-09-21)

All three screens landed as planned, with a few adjustments made during implementation — noted
here rather than left for the plan to silently disagree with the code:

- **`isNewUser`'s fix needed two conditions, not one.** The sketch below said `isNewUser:
  trueFirstAt === windowedFirstAt`. That alone is a bug: with no `from` at all, `trueFirstByUser`
  trivially reuses `grouped` (same source), making the check vacuously true for every row and
  silently dropping the original "only one login, ever" meaning entirely. The actual fix keeps the
  original check (`firstAt === lastAt`, still exactly right when unwindowed) and adds the
  windowing guard as a second, additional condition: `isNewUser: firstAt === lastAt &&
  trueFirstAt === firstAt`. Caught by the pre-existing `listRecentLogins` test suite before it
  shipped — see `admin.service.spec.ts`'s "does not call a returning user 'new'..." case for the
  regression this guards against.
- **`DateRangeFilter` takes `currentFrom`/`currentTo` as explicit props**, not derived from `sp`
  internally — needed so a preset (e.g. "1 day") highlights correctly on a fresh visit where the
  URL carries no `from`/`to` at all but the page has already defaulted them.
- **When a preset is active, `DateRangeFilter` emits hidden `from`/`to` inputs** so "Apply
  filters" keeps the chosen range. Without that, the custom date fields are unmounted and Apply
  dropped the params — the page silently fell back to the 1-day default, so "7 days" looked
  broken as soon as any other filter was applied.
- **Listings uses one filter form** (same shape as logins): top bar + column-header inputs share
  a single "Apply filters" submit. The table's separate "Go" button was removed — two forms were
  fighting each other via incomplete hidden carries.
- **Recent Logins' row click is the expand toggle itself** (no separate button), unlike
  Listings/Page visits — there was no competing whole-row navigation to avoid here (only the
  user-name link, which stops propagation), so the simpler ConversationsTable shape fit directly.
- **`ListingRowDetail.tsx` is a new, purpose-built panel**, not literal reused JSX from
  `/listings/[id]` — that page also fetches owner/engagement/edit-history/conversations/the
  moderation thread, none of which belongs in a quick inline glance.

## Context

Three admin list screens currently do more work than their tables actually use, and load
unbounded history by default:

- **Listings** (`/`, root dashboard): `listForAdmin` fetches the *full* `ListingDetailDto` for
  every row — full-size photo arrays, video arrays, renewal history, contact-reveal fields,
  `attributes` JSON — via the same `LISTING_MEDIA_INCLUDE`/`toDetailDto()` machinery the single
  `/listings/[id]` detail page uses. `AdminListingsTable.tsx` doesn't render any of that; it only
  reads title/status/moderation/category/city/area/source/notification-send-log/counts/price/dates.
- **Recent logins** (`/logins`): has no DB-level date filtering or pagination at all.
  `listRecentLogins` `groupBy`s the *entire* `LoginEvent` table (optionally scoped by `userId`
  only), then applies `from`/`to`/`search`/`method`/`isNewUser`/`hasPostedAd` filtering, sorting,
  and pagination as in-memory array operations — explicitly noted in the code's own comment as a
  deliberate simplicity tradeoff at today's table size, not a bug, but the wrong shape once the
  goal is "load only what's needed."
- **Page visits** (`/page-visits`): already close to minimal server-side (real DB-level
  pagination and date filtering), but its "Pages" count links to a *separate* page
  (`/page-visits/[sessionId]`) instead of expanding inline, and has no quick date-range presets.

The goal: cap each page's *initial* load to roughly 1–3 network calls, defer any given row's full
detail until an admin actually expands that row (fetched once, cached, multiple rows can stay
expanded at once), and default every screen to a 1-day window with quick presets (1/7/15/30 days,
custom) instead of loading unbounded history by default.

Confirmed with the user: the 1-day default applies to all three screens, including Listings (so
the moderation queue defaults to "created today" — a deliberate behavior change, not an oversight).

## Shared pieces (build these first — all three screens depend on them)

### `apps/admin/src/lib/dateRangeDefaults.ts` (new)

Extract the IST-day-boundary math that already exists locally in
`apps/admin/src/app/page-visits/page.tsx:74-75` (`istDayStart`/`istDayEnd`) into a shared module,
and add:

```ts
export function istDayStart(d: string | undefined): string | undefined // unchanged logic
export function istDayEnd(d: string | undefined): string | undefined   // unchanged logic
/** Today's IST calendar day as YYYY-MM-DD, for defaulting date-range params that are absent. */
export function todayIST(): string
/** YYYY-MM-DD for `days - 1` days before today, IST — todayIST() itself is "1 day". */
export function daysAgoIST(days: number): string
```
Update `page-visits/page.tsx` to import `istDayStart`/`istDayEnd` from here instead of defining
them locally.

### `apps/admin/src/components/DateRangeFilter.tsx` (new, client component)

Renders preset pills — **1 day / 7 days / 15 days / 30 days / Custom** — plus (only when Custom is
active) the existing native `<input type="date">` pair each page already has. Props:
```ts
{ basePath: string; sp: SearchParams; fromParam?: string; toParam?: string } // fromParam/toParam default "from"/"to"
```
- Each preset is a plain link (`<Link prefetch={false} href="...">`, matching this session's
  established convention for links that always carry a real query — see
  `rememberedFilters.ts`/`middleware.ts`) built the same way `buildPageHref`/`hrefForTab` already
  build hrefs: current `sp` minus `page`, minus the date params, plus the preset's computed
  `from`/`to` (via `daysAgoIST`/`todayIST`) — clicking one navigates immediately, no separate
  "Apply" click needed.
- "Custom" doesn't navigate on click — it just reveals the two native date inputs already in each
  page's filter `<form>`, submitted via the existing "Apply filters" button.
- When a preset is highlighted (custom fields hidden), the component still submits the active
  range via hidden `fromParam`/`toParam` inputs — otherwise Apply would drop the dates and the
  page's silent 1-day default would take over.
- Highlight whichever preset's computed range matches the current `from`/`to` exactly; if
  `from`/`to` are present but match no preset, highlight "Custom" instead.
- Used by all three pages with different `fromParam`/`toParam` (Listings uses `createdFrom`/
  `createdTo`; the other two use the existing `from`/`to`).

### Default-to-1-day, per page (not a redirect)

Each of the three pages applies `daysAgoIST(1)`/`todayIST()` as the *effective* filter value when
its date params are absent — the same pattern `page-visits/page.tsx` already uses for
`DEFAULT_TRAFFIC`/`DEFAULT_SORT` (`page-visits/page.tsx:44-53`, `26-28`). This deliberately does
**not** redirect the URL to show the default — it mirrors how `DEFAULT_TRAFFIC` already works
(applied silently, only becomes visible in the URL once the visitor picks something else). Keeps
this independent of (and simpler than) the remembered-filters middleware, which still separately
restores whatever range an admin last picked, if any.

### Row-expansion pattern (copy from `apps/admin/src/components/ConversationsTable.tsx`)

All three tables reuse the existing shape from `ConversationsTable.tsx:26-43,65-101` and its
server action (`apps/admin/src/app/actions/admin.ts:289-304`), with one deliberate change:
**`expandedIds: Set<string>`** instead of `expandedId: string | null`, so opening one row doesn't
close another (confirmed with the user — multiple rows can stay expanded at once). Toggling calls
`setExpandedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; })`.
Each table keeps its own `Record<id, Detail | "loading" | "error">` cache exactly like
`ConversationsTable` does — expand once, re-toggling never re-fetches.

Detail row shape per table: `<Fragment key={row.id}>` wrapping the existing row `<tr>` plus a new
sibling `<tr><td colSpan={N}>` for the detail panel, exactly like `ConversationsTable.tsx:65-101` —
`N` = however many columns are visible + 1 for the checkbox/expand-toggle column.

## Listings (`/`)

### Backend (`apps/bff/src/listings/listings.service.ts`)

`listForAdmin` (`:670-774`) currently spreads `...LISTING_MEDIA_INCLUDE` (`:222-232` —
`listingPhotos`, `listingVideos`, `owner`, `listingRenewals`) into its `include` and maps every row
through `toDetailDto()`. Confirmed via direct reads: `toCardDto()` (`:2447-2505`, which
`toDetailDto` calls internally) requires `listing.listingPhotos`/`listingVideos` for `photos`/
`hasVideo`/`imgLabel` — none of which `AdminListingsTable` renders (confirmed against its full
column list) — so the admin list variant should bypass both `toCardDto` and `toDetailDto` entirely
rather than trim their output after the fact.

1. New `include` for `listForAdmin`: `{ city: true, area: true, notificationLogs: {...as today...},
   _count: {...as today...} }` — drop `...LISTING_MEDIA_INCLUDE` completely. `viewCount`/
   `likeCount`/`price`/`priceQualifier`/`boostedUntil`/`instantAlertsUntil` are plain scalar
   columns on `Listing` itself (confirmed at `:2494-2498`) — no relation needed for any of them.
2. New private mapper, e.g. `toAdminQueueRowDto(listing, extras)`, building only what
   `AdminListingsTable` actually reads: `id`, `title`, `status`, `moderationState`,
   `adminReviewed`, `category`, `transactionType`, `cityName` (`city.name`), `area` (`area.name`),
   `source`, `claimSource`, the four `postedNotification*` fields, `boostPromo`, `viewCount`,
   `likeCount`, `messageCount`, `price`, `priceQualifier`, `createdAt`, `updatedAt`, `expiresAt`,
   `isExpired`. No photos/videos/renewals/owner/attributes/description/contact fields.
3. New slim response type in `packages/types` (e.g. `AdminListingRowDto`) — a real subset
   interface, not a `Partial<ListingDetailDto>` cast, so the table's prop type stays precise.
   Update `AdminListingsPage.items` to this type, and `AdminListingsTable`'s `items` prop
   accordingly (should typecheck cleanly since the table already only reads this subset — verified
   in the earlier audit's column table).
4. **Expand-detail: no new endpoint needed.** `findOne` (`:963-996`, backing `GET /listings/:id`,
   already used by `fetchListingById` in `apps/admin/src/lib/bff.ts:231-233`) was confirmed to have
   no side effects that matter here — no view-count increment, just reads plus a
   `ContactRevealService.getRevealState` lookup — safe to call on-demand purely for an admin
   expanding a row. Add a new server action `fetchListingDetailAction(listingId)` in
   `apps/admin/src/app/actions/admin.ts` (mirrors `fetchConversationMessagesAction`, wraps
   `requireAdmin()` + `fetchListingById`).

### Frontend (`apps/admin/src/components/AdminListingsTable.tsx`)

- Apply the shared expand pattern: `expandedIds`, per-row cache of `ListingDetailDto | "loading" |
  "error"`, fetched via the new server action.
- Add an expand-toggle affordance in the row. The row's own `<tr onClick={() =>
  router.push(...)}>` (`:479-502`) must stay for navigating to the full detail page — the existing
  checkbox `<td onClick={(e) => e.stopPropagation()}>` (`:486`) is the precedent for adding a
  second interactive control inside the row without triggering that navigation; the expand toggle
  follows the same pattern.
- New `ListingRowDetail.tsx` component for the expanded panel's content: description, photos
  (`photosFull`), video status, `attributes`, renewal history, contact-reveal info — base its
  layout on whatever `apps/admin/src/app/listings/[id]/page.tsx` already renders for these same
  fields (not read in this planning pass — read it first during implementation and condense its
  relevant sections rather than inventing new presentation).
- Add `DateRangeFilter` to `page.tsx`, wired to `createdFrom`/`createdTo` (the fields
  `listForAdmin` already filters on, `:699-706`) — default via `daysAgoIST(1)`/`todayIST()` when
  absent, applied in `page.tsx` before calling `fetchAdminListings`, the same way `DEFAULT_TRAFFIC`
  is applied today on the page-visits page.

## Page visits (`/page-visits`)

### Backend

No changes needed. `listPageVisits` (`admin.service.ts:560-700`) and `getSessionTrail`
(`:704-764`, backing `fetchSessionTrail`) are both already appropriately scoped. The
header average-per-session raw SQL (`:611-618`) already respects `from`/`to` — once the page
defaults to a 1-day window, that aggregate automatically becomes cheap too (index-bound by date)
with no separate change required.

### Frontend

- `page-visits/page.tsx` is currently a server component rendering the whole `<table>` inline —
  extract the row-rendering (currently `:304-357`) into a new client component
  `PageVisitsTable.tsx`, taking `items: PageVisitDto[]` as a prop, mirroring how
  `AdminListingsTable` is already split out. The page keeps the filter form/header (server
  rendered) and renders `<PageVisitsTable items={result.items} />` in place of the inline
  `<tbody>` map.
- Apply the shared expand pattern in the new component. The "Pages" cell currently does
  `<Link href={`/page-visits/${v.sessionId}`}>{v.pageViewCount}</Link>` (`:311-313`) — change this
  to an expand toggle instead of a navigation link. Leave the standalone
  `/page-visits/[sessionId]` route in place (harmless to keep for direct links/bookmarks); just
  stop it being the primary interaction from the table.
- New server action `fetchSessionTrailAction(sessionId)` (mirrors `fetchConversationMessagesAction`)
  wrapping the existing `fetchSessionTrail` BFF call — no backend change, just plumbing so the new
  client component (which can't call the server-only BFF client directly) can reach it.
- Detail panel content: the same page-view trail already rendered on the standalone
  `[sessionId]` page (`page-visits/[sessionId]/page.tsx:108-151`) — condense that into the inline
  panel.
- Add `DateRangeFilter` next to the existing From/To inputs (`:193-198`), default via
  `daysAgoIST(1)`/`todayIST()` in `page-visits/page.tsx` when `from`/`to` are absent (mirrors the
  existing `DEFAULT_TRAFFIC` pattern already in this exact file).

## Recent logins (`/logins`)

### Backend (`apps/bff/src/admin/admin.service.ts`)

This is the real rearchitecture. Currently `listRecentLogins` (`:446-554`) `groupBy`s the entire
`LoginEvent` table unfiltered by date, then applies `from`/`to` as an in-memory filter against the
derived `lastLoginAt` (`:520-527`).

1. **Push the date range into the `groupBy`'s `where`** instead: `where: { ...(userId ? {userId} :
   {}), ...(from || to ? { createdAt: { gte: from ? new Date(from) : undefined, lte: to ? new
   Date(to) : undefined } } : {}) }`. `LoginEvent` already has `@@index([userId, createdAt])` and
   `@@index([createdAt])` (`schema.prisma:664-686`) — this turns the expensive full-table scan into
   an index-bound range scan, the actual performance win requested. Delete the now-redundant
   in-memory `from`/`to` filter block (`:520-527`) — the DB `where` already enforces it.
2. **Semantic shift, worth being explicit about**: `firstLoginAt`/`lastLoginAt`/`isNewUser` now
   describe login activity *within the selected window*, not all-time. A user who logged in 3 days
   ago and not since won't appear in a default "last 1 day" view — this is the intended behavior
   (matches "show me today's logins"), but `isNewUser` needs a correctness fix to avoid a false
   positive: someone who logged in 2 months ago AND yesterday would otherwise show
   `firstLoginAt == lastLoginAt` *within* a 1-day window and read as "new," when they aren't. Fix:
   after getting the windowed `grouped` result, run one additional cheap `groupBy` scoped to just
   those user ids (indexed lookup, not a scan — `where: { userId: { in: windowedUserIds } }`,
   `_min: { createdAt: true }`) to get each user's *true* global first login, and set
   `isNewUser: trueFirstAt.getTime() === windowedFirstAt.getTime()` — "the earliest login this user
   has ever made falls inside this window."
3. **New endpoint for the expand-detail**: nothing today serves a single user's full login
   history. Add `GET /admin/users/:userId/login-history` (new `AdminController` route +
   `AdminService` method), returning every `LoginEvent` for that user — method, resolved device
   (via the same manual `sessionId`-based `Visit` lookup already used at `:463-471`, since
   `LoginEvent.sessionId` is deliberately not a Prisma relation — `schema.prisma:669-679`), and
   `createdAt` — paginated (`offset`/`limit`, default/cap similar to `SESSION_TRAIL_CAP`'s
   precedent, `admin.service.ts:71`) since a very active user could have many rows.
   - New types in `packages/types`: `UserLoginHistoryEntryDto` / `UserLoginHistoryPage`.
   - New BFF client fn `fetchUserLoginHistory(accessToken, userId, query)` in
     `apps/admin/src/lib/bff.ts`, mirroring `fetchListingEngagement`'s shape (`:327-338`).
   - New server action `fetchUserLoginHistoryAction(userId)`.

### Frontend

- Extract `logins/page.tsx`'s table into `RecentLoginsTable.tsx`, same pattern as the other two.
  Read the current row markup first (not captured in this planning pass) to preserve whatever
  navigation/link behavior already exists on each row while adding the expand toggle.
- Detail panel: the user's full login history (method, device, timestamp per row) from the new
  endpoint.
- Add `DateRangeFilter`, default via `daysAgoIST(1)`/`todayIST()` when `from`/`to` are absent,
  applied in `logins/page.tsx` before calling `fetchRecentLogins`.

## Verification

1. `pnpm --filter admin typecheck` / `pnpm --filter bff typecheck` after each page's changes.
2. `pnpm --filter admin lint` / `pnpm --filter bff lint`.
3. Backend: add/run tests for `listRecentLogins`'s date-pushdown and the `isNewUser` correctness
   fix specifically (the "old login + one login yesterday" case) — check for an existing
   `admin.service.spec.ts` first and follow its conventions if present.
4. `pnpm --filter admin test` (vitest) — extend with a couple of cases for `daysAgoIST`/`todayIST`
   in the new `dateRangeDefaults.ts`.
5. Manual, via the `run` skill or local dev server + curl: compare response payload size for
   `GET /admin/listings` before/after removing `LISTING_MEDIA_INCLUDE` (quantifies the actual win),
   and confirm `GET /admin/logins` with a 1-day range returns quickly against real data rather than
   scanning the full table (check query timing/logs, not just correctness).
6. In the browser: for each of the three pages — confirm initial load fires only the expected 1-3
   requests (Network tab), confirm expanding a row fetches once and caches (re-toggle doesn't
   re-fetch), confirm multiple rows can stay expanded simultaneously, confirm each date preset
   navigates and highlights correctly, confirm Custom reveals the date inputs and Apply works.
