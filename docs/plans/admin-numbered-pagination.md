# Numbered pagination (with a page-size selector) across all admin list pages

## Context

Every list page in the admin app (`apps/admin`) currently either has "Load more"/"Next page →"
cursor-based append pagination, or — for the root listing-moderation dashboard and the discount
codes page — no pagination control at all (results past the hardcoded fetch limit are silently
unreachable). The user wants every admin list page converted to real numbered pagination, with a
selectable page size (10 / 25 / 50 / 100), so an admin can jump to an arbitrary page and control
how many rows they see at once — "Load more" only ever lets you go forward one chunk at a time and
never shows how many pages/records exist.

There are exactly 9 such list pages/endpoints, and all 9 follow one identical architecture end to
end (same Prisma cursor pattern in the BFF, same `{items, nextCursor, total}` response shape, same
`<form method="get">`-and-`<Link>` UI convention in the admin app). This plan describes that one
pattern once; every page gets the same treatment.

The public (non-admin) listings endpoint already migrated from cursor to offset pagination for
exactly this reason — see `docs/plans/seo-distinct-window-pagination.md` and
`ListingsService.list()` / `ListListingsDto.offset` in `apps/bff/src/listings/`. That migration is
the reference implementation and already encodes two hard-won lessons that apply here unchanged
(see "Gotchas" below): a missing `id` tiebreaker in `orderBy` can make offset pages skip/duplicate
rows, and Prisma's generated `findMany` overloads can't resolve a single call built from a spread
ternary — it has to be two explicit branches.

**Confirmed via exhaustive repo-wide grep: none of the 9 admin/outreach BFF list methods are called
by anything other than the admin app's own fetchers** (no mobile, no web, no cron job, no test
suite). `cursor`/`nextCursor` can be deleted outright and replaced with `offset` — no compatibility
shim needed.

## The 9 pages/endpoints

| # | Admin page | BFF method | DTO | Has filter `<form>` today? |
|---|---|---|---|---|
| 1 | `app/page.tsx` (listing moderation) | `ListingsService.listForAdmin` | `ListAdminListingsDto` | yes |
| 2 | `app/users/page.tsx` | `AdminService.listUsers` | `ListUsersDto` | yes |
| 3 | `app/logins/page.tsx` | `AdminService.listRecentLogins` | `ListLoginsDto` | yes |
| 4 | `app/page-visits/page.tsx` | `AdminService.listPageVisits` | `ListPageVisitsDto` | yes |
| 5 | `app/outreach/contacts/page.tsx` | `OutreachService.listContacts` | `ListOutreachContactsDto` | yes |
| 6 | `app/boosts/page.tsx` | `AdminService.listBoosts` | `ListBoostsDto` | no |
| 7 | `app/discount-codes/page.tsx` | `AdminService.listDiscountCodes` | `ListDiscountCodesDto` | no — also has no `searchParams` prop at all today, needs adding |
| 8 | `app/outreach/campaigns/page.tsx` | `OutreachService.listCampaigns` | `ListOutreachCampaignsDto` | no |
| 9 | `app/outreach/sends/page.tsx` | `OutreachService.listSends` | `ListCampaignSendsDto` | no — but has pass-through `campaignId`/`contactId` params to preserve |

All 9 DTOs live in `apps/bff/src/admin/dto/*.ts`; `outreach.service.ts`'s three methods
(`listContacts`/`listCampaigns`/`listSends`) declare their **own inline parameter types** rather
than importing the DTO class, so the `cursor → offset` rename must be applied in the DTO *and* the
service's inline type for those three — easy to miss one.

## 1. BFF: DTOs — `cursor` → `offset`

In each of the 9 DTOs (and the 3 inline outreach parameter types), replace:
```ts
@IsOptional()
@IsString()
cursor?: string;
```
with the exact validator `ListListingsDto.offset` already uses:
```ts
@IsOptional()
@Type(() => Number)
@IsInt()
@Min(0)
offset?: number;
```
While touching these, standardize every DTO's `limit` default to `25` (currently an inconsistent
mix of `24`/`50`) — the admin pages will always send `limit` explicitly now, but there's no reason
to leave the stale defaults.

## 2. BFF: service methods — offset instead of cursor

For each of the 9 methods, replace the cursor branch with two **explicit** `findMany` calls (not a
spread ternary — see `ListingsService.list()`'s own comment on why: Prisma's generated overloads
can't resolve a call built from a union of arg shapes):
```ts
// before
take: limit + 1,
...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
// ...then hasMore/nextCursor slicing

// after
skip: offset ?? 0,
take: limit,
// items = rows directly, no over-fetch/slicing needed — total is already known
```
Drop the `hasMore`/`nextCursor` computation entirely; map `rows` straight into `items`.

**Tiebreaker fix, in the same pass:** 4 of the 9 `orderBy` clauses have no secondary sort key and
would be exposed to skip/duplicate rows across a page boundary on a timestamp tie (bulk CSV
contact imports, a batch of sends from one campaign run, boosts granted in the same promo — exactly
the "bulk insert, same timestamp" scenario the SEO migration hit). Add `{ id: 'asc' }` as a second
`orderBy` entry to:
- `AdminService.listBoosts` (`{ boostedFrom: 'desc' }`)
- `OutreachService.listContacts` (`{ createdAt: 'desc' }`)
- `OutreachService.listCampaigns` (`{ createdAt: 'desc' }`)
- `OutreachService.listSends` (`{ createdAt: 'desc' }`)
The other 5 already have a tiebreaker (`ADMIN_ORDER_BY`, `USER_ORDER_BY`, `LOGIN_ORDER_BY`,
`PAGE_VISIT_ORDER_BY`, discount codes' own `orderBy` array) — leave those as-is.

Note, not a blocker: page-visits is the one genuinely high-volume/unbounded table here (an
analytics log with its own GeoIP backfill script) — `skip: N` costs Postgres an O(N) row walk at
deep page numbers, unlike cursor's O(limit). Same trade-off the SEO migration already accepted for
public listings; not worth solving here.

## 3. `packages/types`: drop `nextCursor` from the 9 response types

Remove `nextCursor: string | null` from `AdminListingsPage`, `AdminUsersPage`, `LoginEventsPage`,
`PageVisitsPage`, `ListingBoostsPage`, `AdminDiscountCodesPage`, `OutreachContactsPage`,
`OutreachCampaignsPage`, `CampaignSendsPage` in `packages/types/src/index.ts` — `total` plus the
client's own `page`/`limit` is sufficient for numbered pagination.

**Do not touch** `ListingsPage` or `PaymentHistoryPage` in the same file — both also have
`nextCursor` but are unrelated, real infinite-scroll consumers (`ListingsPage` backs
`apps/web`'s/`apps/mobile`'s public browse `useInfiniteListingsQuery`; `PaymentHistoryPage` backs
`apps/web/src/app/purchases/page.tsx`). Only the 9 admin/outreach types listed above are in scope.

## 4. `apps/admin/src/lib/bff.ts`: fetchers

For each of the 9 corresponding `*Query` interfaces, replace `cursor?: string` with
`offset?: number`, threaded into the `URLSearchParams` construction the same way `cursor` is today.

## 5. `apps/admin/src/lib/searchParams.ts`: two new shared helpers

```ts
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export function parsePageSize(raw: string | undefined): number {
  const n = Number(raw);
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(n) ? n : 25;
}

/** Carries every current query param forward except `page`, which is set to the target page.
 * Replaces every page's own hand-rolled `loadMoreHref`. */
export function buildPageHref(basePath: string, sp: SearchParams, page: number): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (key === "page") continue;
    const v = str(value);
    if (v) params.set(key, v);
  }
  if (page > 1) params.set("page", String(page));
  return `${basePath}?${params.toString()}`;
}
```
(`SearchParams` = the `Record<string, string | string[] | undefined>` type each page already
declares locally — hoist it here too if not already shared.)

## 6. New `apps/admin/src/components/Pagination.tsx`

Port `apps/web/src/components/home/Pagination.tsx`'s shape — props `{ currentPage, totalPages,
buildHref: (page: number) => string }`, and its `pageNumbersToShow(currentPage, totalPages)`
ellipsis-collapsing logic copied verbatim (it's pure, no Tailwind dependency). Restyle with inline
`React.CSSProperties` using the admin app's existing CSS variables (`var(--green)`, `var(--border)`,
`var(--surface)`, `var(--on-green)`, `var(--muted)`, `var(--text)`, `var(--text-soft)`,
`var(--surface-alt)`) to match `apps/admin`'s existing look. **`apps/admin` has no `Icon`
component** — use plain arrow characters (`←`/`→`) for prev/next, consistent with the "← Back to
dashboard" / today's "Load more →" links already in these pages, not an icon import.

## 7. Per-page changes (all 9)

- Read `page` (`Number(str(sp.page)) || 1`) and `limit` (`parsePageSize(str(sp.limit))`) instead of
  `cursor`. Compute `offset = (page - 1) * limit`.
- Pass `{ ...filters, offset, limit }` to the fetcher instead of `{ cursor, limit: <hardcoded> }`.
- Compute `totalPages = Math.max(1, Math.ceil(result.total / limit))`.
- Replace the "Load more"/"Next page →" `<Link>` (add one, for the 2 pages that have none today —
  dashboard and discount codes) with
  `<Pagination currentPage={page} totalPages={totalPages} buildHref={(p) => buildPageHref(basePath, sp, p)} />`.
- Add a page-size selector: `<AutoSubmitSelect name="limit" defaultValue={String(limit)} options={PAGE_SIZE_OPTIONS.map(n => ({value: String(n), label: `${n} / page`}))} style={selectStyle} />`.
  - **Critically: do not add a hidden `page` field anywhere, and do not wire `resetFieldsOnChange`
    for it.** A plain HTML GET-form submission replaces the query string with only the fields
    physically present in that form — since `page` is never one of them, submitting the form (via
    the Apply button, or any auto-submitting field including the new `limit` selector) naturally
    drops `page` back to unset/1 for free. This is exactly the existing mechanism that already
    makes `cursor` disappear on every filter-form submit today; adding an explicit reset would only
    risk a *stale* `page` surviving submission if done wrong (a hidden field is real state, not
    dropped automatically).
  - For the 5 pages that already have a filter `<form>` (dashboard, users, logins, page-visits,
    outreach/contacts): put the `limit` selector **inside** that existing form.
  - For the 4 that don't (boosts, discount-codes, outreach/campaigns, outreach/sends): wrap just
    the selector in a small new `<form method="get">`. `outreach/sends` must also carry its
    existing pass-through params forward as hidden inputs: `<input type="hidden" name="campaignId" value={campaignId ?? ""} />` and the same for `contactId`.
  - `discount-codes/page.tsx` needs a `{ searchParams }` prop added to its page function signature
    first — it currently takes none.

## Verification

1. `apps/bff`: `npx tsc --noEmit`, then run each touched service's tests — none exist for these 9
   methods today (confirmed), so no existing suite to break; optionally add a couple of unit tests
   per the pattern already used for `ListingsService.list()`'s own `offset` tests if the user wants
   coverage, but not required to ship this.
2. `apps/admin` + `apps/web` + `apps/mobile`: `npx tsc --noEmit` in each (confirms `nextCursor`
   removal didn't touch `ListingsPage`/`PaymentHistoryPage` consumers).
3. Manual, per page, against a local or staging BFF: load each of the 9 pages, confirm the record
   count/page-size math (`10/25/50/100` × page N) matches `total`, confirm switching page size
   resets to page 1, confirm changing any other filter also resets to page 1, confirm numbered page
   links jump directly (not just "next"), confirm the last page shows a partial page correctly, and
   confirm `outreach/sends`'s `campaignId`/`contactId` survive a page-size change.
4. Stale-URL check: hit an old `?cursor=...`-style bookmarked admin URL post-deploy — global
   `ValidationPipe({ whitelist: true })` silently strips the now-unknown `cursor` param rather than
   erroring, so it should just resolve to page 1 rather than 400ing.

### Critical files
- `apps/bff/src/admin/dto/*.ts` (7 DTOs) + `apps/bff/src/listings/dto/list-admin-listings.dto.ts`
- `apps/bff/src/admin/admin.service.ts` (6 methods: listings handled via `ListingsService`, so 5 here + listForAdmin lives in listings.service.ts)
- `apps/bff/src/listings/listings.service.ts` (`listForAdmin` only — `list()` is the reference, untouched)
- `apps/bff/src/outreach/outreach.service.ts` (3 methods + their inline param types)
- `packages/types/src/index.ts` (9 interfaces, `nextCursor` removed)
- `apps/admin/src/lib/bff.ts` (9 fetchers' query types)
- `apps/admin/src/lib/searchParams.ts` (new `PAGE_SIZE_OPTIONS`/`parsePageSize`/`buildPageHref`)
- `apps/admin/src/components/Pagination.tsx` (new)
- `apps/admin/src/app/page.tsx`, `users/page.tsx`, `logins/page.tsx`, `page-visits/page.tsx`,
  `boosts/page.tsx`, `discount-codes/page.tsx`, `outreach/contacts/page.tsx`,
  `outreach/campaigns/page.tsx`, `outreach/sends/page.tsx` (all 9)
- Reference only, not modified: `apps/bff/src/listings/dto/list-listings.dto.ts`,
  `ListingsService.list()`, `apps/web/src/components/home/Pagination.tsx`,
  `docs/plans/seo-distinct-window-pagination.md`
