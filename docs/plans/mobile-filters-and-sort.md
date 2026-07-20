# Mobile: filters, sort, and pagination

## Also in scope: responsive grid (2 columns on wide screens)

Verified against `ListingCard.tsx`: its image area is a **fixed pixel height** (`imageArea: {
height: 150, ... }`, not aspect-ratio-based), and the card itself declares no explicit width — it
just fills whatever the `FlatList` gives it. Both matter for a wide-screen grid:

- **Breakpoint**: use RN's `useWindowDimensions()` (not `Dimensions.get('window')` — the hook
  re-renders automatically on rotation/split-view resize, the static call doesn't). `width >= 700`
  → 2 columns, else 1. That threshold sits comfortably below every iPad's portrait width (744pt+)
  and above every phone's, including large phones in portrait.
- **A real RN gotcha, worth flagging explicitly so it isn't hit at implementation time**:
  `FlatList`'s `numColumns` **cannot change on an already-mounted list** — React Native's
  `VirtualizedList` warns/breaks if it changes between renders. The documented fix is to force a
  remount via `key`, e.g. `key={`cols-${numColumns}`}` on the `FlatList` — necessary here since
  rotating an iPad (or resizing a split-view window) changes the column count live, not just at
  first mount.
- **Column gap**: `columnWrapperStyle={{ gap: 12 }}` (only applied when `numColumns > 1` — passing
  `columnWrapperStyle` alongside `numColumns={1}` is itself invalid/warns in RN).
- **`ListingCard.tsx` image fix**: switch `imageArea`'s fixed `height: 150` to an `aspectRatio`
  (e.g. `4/3`), so the image scales proportionally whatever width the card ends up at — a 2-column
  card is roughly half the width of a 1-column one, and a fixed pixel height would look
  disproportionately tall/squashed at the narrower width. This is a real visual bug the current
  code would hit immediately once 2-column rendering exists, not a hypothetical.
- Card width itself needs no hardcoded number — in a 2-column row, each card should be `flex: 1`
  inside its column slot (the existing per-item wrapper in `index.tsx`'s `renderItem`, currently
  just `paddingHorizontal: 16`, becomes the place that also supplies `flex: 1` / half-width sizing).

## Current state (verified, not assumed)

`app/(tabs)/index.tsx` has category tabs (`CategoryChips`) and a search box — nothing else.
`bffClient.ts`'s `ListingsQuery` only carries `homeCategory`, `propertyType`, `cityId`, `q`,
`limit`. No area/BHK/price/furnishing filters, no sort, no pagination (`useQuery` with a fixed
`limit: 20`, no `onEndReached`/load-more at all). `fetchAreas` also lacks the `all` param web's
`AreaFilter` depends on to get a city's full area list.

**None of this needs backend work.** The BFF's `ListListingsDto` already has `areaIds`, `bedrooms:
number[]`, `furnished`, `minPrice`/`maxPrice`, `sort`, and `cursor` — and `cursor`'s own doc comment
already says *"used by append-style infinite scroll (mobile)"*. This is entirely a mobile-client
gap, closeable by extending `bffClient.ts` to match `apps/web/src/lib/bff.ts`'s already-proven
contract, then building the mobile-appropriate UI on top.

## Scope: match web's actual filter bar, not the full DTO surface

Web's own filter *controls* (as opposed to mega-menu deep-link-only params) are exactly: **Area**
(`AreaFilter`), **BHK** (`BhkFilter`, house/apartment only), **Price** + **Furnishing**
(`BrowseFilterBar`, furnishing house/apartment only), and **Sort** (`SortDropdown`). `sharingType`/
`condition`/`serviceType` are mega-menu-link-only on web today — no filter-bar UI sets them, so
mobile doesn't need to build one either. Matching this scope (not the raw DTO) keeps the mobile
build from inventing UI for filter dimensions that don't have a proven UX pattern yet.

## Key mobile-specific design decisions (deliberately different from web)

1. **Cursor pagination, not offset+page-number.** Web's numbered `?page=N` exists for SEO —
   distinct, crawlable, indexable URLs. Mobile has no URL/crawler concern at all, and a `FlatList`
   with `onEndReached` is the natural, expected native pattern. Switch `useListingsQuery` to
   **`useInfiniteQuery`** (already have `@tanstack/react-query`), append pages as the user scrolls,
   using the BFF's existing `cursor`/`nextCursor` fields exactly as designed.

2. **One consolidated "Filters" bottom sheet, not five separate dropdown buttons.** Web's row of
   independent popovers (Area/BHK/Price/Furnishing all separately toggleable, each immediately
   navigating) fits a spacious desktop row. On a phone screen, one **"Filters"** button opens a
   single bottom sheet with all applicable sections stacked — matches how most native
   shopping/listings apps present filters, and avoids juggling five separate sheets.

3. **Staged state + explicit Apply, not per-toggle immediate navigation.** Web's filter components
   are pure functions of the URL (`useSearchParams`) — every toggle is an instant `router.push`.
   Mobile has no equivalent "state lives in the URL" mechanism, and batching several changes (e.g.
   two areas + a price bracket) into one API call on "Apply" is both simpler to implement and
   avoids a network round-trip per checkbox tap. The sheet keeps its own local staged state,
   diffed against the screen's actual applied-filters state only on Apply. A "Reset" action clears
   the sheet's staged state back to "all/none" without applying.

4. **Sort as its own small single-choice sheet**, reusing the same `BottomSheetModal` mechanism
   `HomeSheetsProvider` already uses for the location/login sheets — not a new UI paradigm.

5. **A numeric badge on the "Filters" button** (e.g. a small pill showing the active-filter count)
   — standard native affordance, cheap to compute from the same applied-filters state.

## Implementation

### 1. `bffClient.ts` — extend the contract to match web's

```ts
export interface ListingsQuery {
  homeCategory?: HomeCategoryFilter;
  propertyType?: PropertyTypeFilter;
  cityId?: string;
  areaIds?: string[];
  q?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number[];
  furnished?: "unfurnished" | "semi" | "furnished";
  cursor?: string;
  limit?: number;
  sort?: "newest" | "price_asc" | "price_desc" | "popular";
}
```

`fetchListings` serializes `areaIds`/`bedrooms` as comma-joined strings (same wire format as web).
`fetchAreas(cityId, q?, all?)` gains the `all` flag (identical to web's, same endpoint).

### 2. `queries.ts` — `useListingsQuery` becomes `useInfiniteListingsQuery`

```ts
export function useInfiniteListingsQuery(query: Omit<ListingsQuery, "cursor">, accessToken?: string | null) {
  return useInfiniteQuery({
    queryKey: ["listings", query, accessToken],
    queryFn: ({ pageParam }) => fetchListings({ ...query, cursor: pageParam }, accessToken),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}
```

`index.tsx` flattens `data.pages.flatMap(p => p.items)` into the `FlatList`, wires
`onEndReached={() => hasNextPage && fetchNextPage()}` and an `ActivityIndicator` footer via
`ListFooterComponent` while `isFetchingNextPage`.

### 3. New `src/components/home/FilterSheet.tsx`

A `BottomSheetModal` (matching `HomeSheetsProvider`'s existing sheets), taking the current
`category`/`propertyType`/`cityAreas` and the screen's applied filters, rendering:

- **Areas** — checkbox list (all checked = no narrowing, same semantics as web's `AreaFilter`),
  only rendered if `cityAreas.length > 1`.
- **BHK** — chip multi-select (1/2/3/4/5+), only for `propertyType === "house" | "apartment"`,
  reusing `MAX_BEDROOMS`/`bedroomLabel` from `@bhavano/types/bedrooms` (no new constants).
- **Price** — quick-pick brackets sized via `PRICE_BOUNDS` from `@bhavano/types/priceBounds`,
  same geometric-bracket logic as web's `priceBracketsFor` (small shared helper worth lifting into
  `@bhavano/types` at that point, since both apps would then compute it identically instead of
  copy-pasting the formula).
- **Furnishing** — 3-way choice, only for house/apartment.

Footer: **Reset** (clears staged state) / **Apply** (commits staged state up to the parent, closes
sheet, triggers one refetch).

### 4. New `src/components/home/SortSheet.tsx`

Small `BottomSheetModal`, single-select list (Newest / Price: Low-High / Price: High-Low / Most
viewed), same 4 values as web's `SortDropdown` — tap an option, it applies immediately and closes
(no Apply step needed for a single choice).

### 5. `app/(tabs)/index.tsx`

- Fetch the current city's full area list (`fetchAreas(cityId, undefined, true)`) alongside the
  existing listings query.
- New row under `CategoryChips`: **Filters** button (badge = active count) + **Sort** button
  (label = current sort's short name) + the existing result count, replacing/extending the current
  `sectionHeading` row.
- Applied-filters state (`areaIds`, `bedrooms`, `minPrice`/`maxPrice`, `furnished`, `sort`) lives in
  the screen alongside the existing `category`/`propertyType`/`q` state, merged into the same
  `useInfiniteListingsQuery` call.
- Switching `category`/`propertyType` (the existing chips) resets the applied filters — same
  "switching tabs clears stale filters" rule the web `CategoryTabs` already enforces, so a stale
  BHK selection can't silently apply to PG results after a tab switch.
- `numColumns={width >= 700 ? 2 : 1}` on the `FlatList` (from `useWindowDimensions()`), `key`
  keyed off that same column count to force the remount RN requires, and `columnWrapperStyle`
  applied only in the 2-column case (see "Also in scope" above).

## Non-goals for this pass

- No numbered-page pagination on mobile (infinite scroll only — see decision #1).
- No `sharingType`/`condition`/`serviceType` filter UI (not a proven pattern on web either — see
  Scope above); still reachable later the same way web reaches them, if a mobile mega-menu
  equivalent gets built.
- No changes to the BFF — the full param set already exists and is exercised today by web.

## Implementation notes

- One deviation from the sketch above: `FilterSheet`'s `apply()` originally reached into its own
  forwarded `ref` to call `.dismiss()` — fragile (assumes an object ref, not a callback ref).
  Simplified so the parent (which already holds the ref via `useRef`) dismisses the sheet from
  inside its own `onApply` callback instead; `FilterSheet` only ever calls `onApply(staged)`.
- `priceBracketsFor` was kept local to `FilterSheet.tsx` rather than lifted into `@bhavano/types`
  alongside web's identical copy — not worth sharing until a third caller needs the exact same
  geometric-bracket formula (matches the "don't add abstractions beyond what's needed" default).
- Added `useAreasQuery` to `queries.ts`, matching the existing convention of centralizing every
  query hook there (rather than an ad-hoc `useQuery` call inside the screen component).

## Verification plan

- **Done**: `pnpm -w typecheck` — all 5 packages clean.
- **Done**: `npx expo export --platform ios` completed with no errors (1788 modules bundled) —
  confirms every new import (`FilterSheet`, `SortSheet`, `BottomSheetScrollView`,
  `useWindowDimensions`, `useInfiniteQuery`, etc.) resolves at the Metro level too, not just
  TypeScript's.
- **Not done — needs a real device/simulator pass, which this environment can't drive**: the
  interactive/visual items below all require actually running the app.
- Manual pass in Expo Go: apply an area filter, a BHK filter, a price bracket, and furnishing
  together, confirm one combined refetch on Apply (not one per toggle); confirm Reset clears
  staged state without refetching; confirm Sort changes ordering; confirm `onEndReached` loads a
  second page with no duplicate/skipped items (same ordering-stability concern the web pagination
  work already hit once — worth an explicit check here too, since mobile reuses the same `cursor`
  path, which already has the `id`-tiebreaker fix applied server-side).
- Confirm switching category/propertyType clears applied filters (no stale BHK/price carrying into
  an unrelated tab).
- iPad simulator (or a resized/split-view window): confirm 2 columns render, the image aspect
  ratio still looks correct at the narrower card width (not squashed), and rotating the device
  (or resizing a split-view window) between 1- and 2-column widths doesn't warn/crash — the
  `key`-forced-remount is the specific thing this checks. Also confirm a phone-width simulator
  still renders the existing single column, unchanged.
