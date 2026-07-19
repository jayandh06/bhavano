# SEO-friendly distinct-window pagination for browse pages

## Problem

The SEO browse pages (`/{city}/{area}/{group}/{category}`) and the homepage currently paginate by
**growing the limit**: `?page=2` server-renders items **1–24**, `?page=3` renders **1–36**, etc.
(`limit = page × PAGE_SIZE`, offset always 0). The grid shows a single "Load more" `<a href="?page=N">`.

Two SEO weaknesses:

1. **Content overlap across page URLs.** Each `?page=N` is a *superset* of the previous, so
   `?page=1/2/3` share most of their listings. Google re-crawls the same listings on every page —
   wasted crawl budget — and no page URL cleanly "owns" a listing.
2. **Every paginated page canonicalizes to page 1.** `generateMetadata` sets the canonical to the
   clean base path with no `?page=`
   ([apps/web/src/app/[city]/[[...rest]]/page.tsx](../../apps/web/src/app/%5Bcity%5D/%5B%5B...rest%5D%5D/page.tsx),
   `resolvedCanonicalPath`), so `?page=2` declares itself a duplicate of `?page=1`. Deep pages
   won't be indexed, and signals for deeper listings are muddied.

Discovery still *works* today (Googlebot follows the real `<a href="?page=N">` and crawls the
detail-page links on each page), so this is an optimization, not a fix for a broken crawl — but
the overlap + canonical-to-page-1 is meaningfully suboptimal.

## Approach: distinct windows + numbered pagination + self-canonical

Move the **SEO browse pages** to classic windowed pagination:

- `?page=2` renders items **13–24** (a distinct 12-item window), not 1–24.
- Each page is **self-canonical** (`/{path}` for page 1, `/{path}?page=N` for N>1), so Google
  indexes each distinct page instead of collapsing them.
- Replace the single "Load more" link with a **numbered pagination control** (Prev · 1 2 3 … · Next),
  each entry a real `<Link>` — fully server-rendered, no client JS, fully crawlable. This fits the
  RSC architecture and keeps client JS at zero (consistent with the Tailwind-migration goal).

**Why offset, not cursor:** stable, crawlable `?page=N` URLs require offset (`skip`) — a cursor is
opaque, data-dependent, and can't address an arbitrary page directly. The backend's existing
cursor path stays for any append-style caller (e.g. mobile); this adds an `offset` path alongside it.

### Backend (`apps/bff`)

- **`list-listings.dto.ts` + `listings.service.ts`**: add an optional `offset?: number`
  (`@Type(() => Number) @IsInt @Min(0)`). In `list()`, when `offset` is present use
  `skip: offset, take: limit` (drop the `take: limit + 1` / cursor branch for this path — `total`
  already tells the frontend whether more pages exist). Cursor behavior is unchanged when `offset`
  is absent.
- `list()` already returns `total`, which is all the pagination UI needs — no shape change.

### Web (`apps/web`)

- **`lib/bff.ts`**: `ListingsQuery` gains `offset?: number`; `fetchListings` serializes it.
- **`BrowseListingsView.tsx`**: compute `offset = (page - 1) * PAGE_SIZE`, fetch with
  `{ ...query, offset, limit: PAGE_SIZE }` (distinct window). Replace the `loadMoreHref` plumbing
  with a `totalPages = Math.ceil(total / PAGE_SIZE)` and render a new `<Pagination>`.
- **New `Pagination.tsx`** (server component): Prev/Next + a windowed set of page numbers, each a
  `<Link>` to the current path with `?page=N` merged into the *existing* query string (so
  `minPrice`/`furnished`/`areas` survive). Disabled/absent Prev on page 1, Next past the last page.
- **`ListingGrid.tsx`**: drop the `loadMoreHref` prop (pagination moves out of the grid into the
  page body, below it).
- **Canonical (the key SEO change)** in `[city]/[[...rest]]/page.tsx`: make paginated pages
  **self-canonical** — append `?page=N` to the canonical for N>1 (page 1 stays clean). The
  redirect check must ignore `?page=` (already ignores query params) so it doesn't fight this.
  Optionally add `rel="prev"`/`rel="next"` `<link>`s — Google ignores them now but Bing still uses
  them, and they're cheap.

### Homepage (`apps/web/src/app/page.tsx`) — aligned to the same numbered pagination

**Decided: align it.** The homepage is the interactive tab/filter browsing surface and stays
**`canonical: "/"`** regardless (its per-filter variants are never meant to rank separately), so
this is a pure UX/consistency change, not an SEO one. It switches from the growing-`?limit=` "Load
more" link to the same `offset` + `<Pagination>` mechanism as the browse pages, computing
`offset = (page - 1) * PAGE_SIZE` from its own `?page=` param instead of accumulating `?limit=`.
`loadMoreParams`/`loadMoreHref` in `page.tsx` are replaced the same way as in `BrowseListingsView`.

## Tradeoffs & non-goals

- **Offset window-shift**: with `orderBy: createdAt desc`, a newly-posted listing shifts every
  window down by one, so between two crawls a listing can appear on two pages or be skipped once.
  Minor for SEO (Google re-crawls); the alternative (keyset) can't do page numbers. Accepted.
- **Deep-page thinness**: self-canonical *all* pages for v1. A later refinement could
  `noindex,follow` pages beyond a depth threshold (keeps crawl-through, drops thin deep pages from
  the index) — noted, not done now.
- **Sitemap unchanged**: it lists page-1 browse URLs only; deeper pages are discovered via the
  crawlable Prev/Next links, which is the intended mechanism. No paginated URLs added to the sitemap.
- **Out-of-range pages 404 (decided).** `?page=999` when only 3 pages exist calls `notFound()` —
  same pattern the catch-all route already uses for invalid segments/listing ids. This is standard
  practice for exhausted pagination: it signals clearly to crawlers that the page doesn't exist and
  avoids an infinite crawl trap of thin/empty pages that a 200-OK empty grid would otherwise create.
  Applies to both the SEO browse pages and the homepage.

## Implementation notes & a real bug caught during verification

- Implemented as planned: `offset` added to the DTO/`list()` (branched into two explicit
  `findMany` calls — Prisma's generated overloads can't resolve a call built by spreading a
  ternary union of arg shapes, so a plain `if/else` was used instead); `Pagination.tsx` is a
  server component (real `<Link>`s, zero client JS); both `BrowseListingsView` and the homepage
  compute `offset = (page-1) * PAGE_SIZE` and render it; `[city]/[[...rest]]/page.tsx`'s
  `generateMetadata` now takes `searchParams` and self-canonicalizes `?page=N` (N>1) while page 1
  stays clean; both routes 404 via `notFound()` when `page > 1 && page > totalPages`.
- **Bug caught by verification, not assumed away**: initial live testing showed real *overlap*
  between `?page=1` and `?page=2` (shared items), which would have defeated the entire point of
  this migration. Root cause: `orderBy: { createdAt: 'desc' }` alone has no tiebreaker, and rows
  inserted in bulk (e.g. the demo seed script) can share an identical `createdAt` — Postgres then
  has no guaranteed stable order for ties, so the same offset window can land on different rows
  across requests. Fixed by adding `id` as a secondary sort key: `orderBy: [{ createdAt: 'desc' },
  { id: 'asc' }]`, applied to both the offset and cursor branches. Re-verified deterministic
  (3 repeated identical queries returned identical ordering) and zero overlap across 3 real pages
  after the fix.
- `parsePage` was added as a shared export in `seoRoute.ts` (used by both the homepage and the
  `[city]` route) rather than duplicated, so the two can never disagree on how a `?page=` value
  parses.

## Verification (all passed against the running dev servers)

- **Offset correctness at the API layer**: `?offset=0` vs `?offset=12` on the same query returned
  different first-item ids (confirmed directly against the BFF).
- **Distinct windows end-to-end**: 3 real multi-page routes tested (a homepage tab query and the
  bare `/bengaluru` city-root, each with >12 real listings) — zero link overlap across pages 1↔2,
  2↔3, and 1↔3, on both the homepage and the `[city]` route.
- **Self-canonical pagination**: page 1 → clean canonical + plain title; page 2 → canonical
  `?page=2` (self-referential) + title suffixed `— Page 2` (confirmed via response headers).
- **Existing filter-canonical behavior unaffected**: `?minPrice=1000` and explicit `?page=1` both
  still collapse to the clean canonical, exactly as before this change.
- **Out-of-range 404**: confirmed on both a genuinely single-page route (`?page=2` when only 1
  page exists) and the multi-page route (`?page=4` when only 3 exist) — both return real HTTP 404.
- **Pagination UI**: `<nav aria-label="Pagination">` renders on paginated pages; page-number links
  correctly preserve existing query params (`city`, `category`, etc.) alongside the new `page=`.
- `pnpm -w typecheck` — all 5 packages (including mobile/admin) clean.

## Original verification checklist

- `?page=2` on a city+category with >12 listings shows items **13–24** (distinct from page 1), and
  its canonical is `…?page=2` (self), not the bare path.
- Page 1 canonical stays the clean path; `?page=1` (if ever hit) redirects/normalizes to it.
- Prev/Next/number links carry existing `minPrice`/`areas`/etc. query params.
- Out-of-range `?page=999` returns a real 404 (`notFound()`) on both browse pages and homepage.
- Homepage pagination renders via the same `<Pagination>` component; still `canonical: "/"`.
- Backend: `offset` path returns the right window and `total`; cursor path unchanged (mobile still works).
- `pnpm typecheck` across packages; rebuild `@bhavano/types` if `ListingsQuery`/DTO shared types change.
