# Locality long-tail SEO: landing copy, links, and metadata

## Context

Bhavano’s **URL and heading model** already targets locality + intent queries (e.g. “3 BHK for sale in Koramangala”) via the city-first hierarchy documented in [`city-first-seo-url-hierarchy.md`](./city-first-seo-url-hierarchy.md):

```text
/{city}[/{area}][/{buy|rent-lease}][/{category}][/{facet}]
```

Examples:

- `/bengaluru/koramangala/buy/apartment`
- `/bengaluru/koramangala/buy/apartment/3bhk`
- `/bengaluru/hsr-layout/buy/apartment`

`buildHeading()` in `seoRoute.ts` already produces human H1s aligned with those paths. Technical SEO (canonicals, breadcrumbs JSON-LD, sitemap, footer city/area links, pagination) is largely done per [`seo-google-ads-readiness.md`](./seo-google-ads-readiness.md) and related plans.

**What’s weak for unpaid search** is **page substance**: browse routes render an H1, filters, and a listing grid with a generic meta description (`Browse {heading} on Bhavano.`). Competitors ranking for “flats in HSR Layout” typically pair inventory with **unique intro copy** and **contextual internal links** (sibling localities, related facets).

This plan adds **server-rendered, template-driven content** on SEO browse pages — no CMS v1, no paid ads requirement. It complements (does not replace) crawl-discovery work in [`seo-remaining-improvements.md`](./seo-remaining-improvements.md) (especially **SearchSuggestions**).

**Confirmed decisions (proposed — adjust before implementation if product disagrees):**

- **Template-only copy** for v1 (deterministic strings from `cityName`, `areaName`, `category`, `transactionGroup`, `facet`, `total` listings). No admin-edited paragraphs per area in v1.
- **Scope = SEO catch-all browse pages only** (`BrowseListingsView` + `[city]/[[...rest]]/page.tsx` metadata). Homepage tab browsing stays unchanged in v1.
- **No new indexed URLs for price filters** (`?maxPrice=` stays non-canonical per existing filter policy). Optional v2: a small set of **curated** “under ₹X in {area}” hubs if product wants those terms explicitly.
- **“Nearby areas”** v1 = **same city, other areas** (exclude current), capped (e.g. 8 links), not geo-distance (no lat/lng adjacency table yet).

---

## Goals

| Goal | How we’ll measure |
|------|-------------------|
| Richer snippets / relevance for local queries | Search Console: impressions/clicks on `/{city}/{area}/…` URLs |
| Less “thin content” risk on area hubs | Manual QA + optional Lighthouse “SEO” (informational only) |
| Stronger internal linking between localities | Crawl: more in-content `<a href>` between area pages (not only footer) |
| No regression to URL/canonical rules | Existing pagination + filter canonical tests still pass |

---

## Phase 1 — `BrowseSeoIntro` (unique on-page copy)

### 1.1 Pure copy builder

**New file:** `apps/web/src/lib/browseSeoCopy.ts` (no React — easy to unit-test)

**Input:** same dimensions as `buildHeading` / `ParsedSegments` resolution:

- `cityName`, optional `areaName`
- `transactionGroup`, optional `category`, optional `facetValue` (BHK / PG sharing / etc.)
- `listingTotal: number` (from `fetchListings` total on page 1)

**Output:**

- `introParagraphs: string[]` — 1–2 short paragraphs (plain text).
- `relatedLinks: { label: string; href: string }[]` — sibling drill-downs (see Phase 2).

**Template rules (examples):**

- **Area + category + buy:**  
  “Browse {total} {category label} for sale in {area}, {city}. Listings are posted directly by owners and agents on Bhavano — no login required to search.”
- **Area + apartment + 3bhk facet:**  
  Mention “3 BHK” explicitly; link text in related links can mirror H1 patterns.
- **City root only (`/{city}`):**  
  One paragraph on browsing across localities in {city}; point to footer / related city links (already exist).
- **Zero listings:**  
  Honest copy (“No active listings right now”) + CTA to post or broaden to city-level category link — avoid keyword stuffing.

Reuse `CATEGORY_LABELS`, `TRANSACTION_LABELS`, `bedroomLabel`, `buildBrowsePath` — **do not** duplicate label logic from `buildHeading`; optionally call shared helpers or pass **precomputed `heading`** into the copy builder to stay in sync.

### 1.2 Presentational component

**New file:** `apps/web/src/components/home/BrowseSeoIntro.tsx` (server component)

- Renders `introParagraphs` as `<p>` with `text-sm text-text-soft leading-relaxed`.
- Renders `relatedLinks` as a compact row of `<Link>` chips (reuse visual language from planned `SearchSuggestions` / `SearchBar` chips).
- Placed **under the H1 row**, **above** filters (see wireframe below).

```
[H1]                                    [N listings]
<BrowseSeoIntro paragraphs + related links>
[AreaFilter] [BhkFilter] [BrowseFilterBar] …
[ListingGrid]
```

### 1.3 Wire into `BrowseListingsView`

- Extend props: `currentSegments: ParsedSegments` already present — pass into copy builder along with `listingPage.total`, `cityName`, `areaName`, `cityAreas`.
- Only render full intro on **page 1** (`page === 1`). Page 2+ keeps H1 + grid (optional one-line “Page N of …” — already in title metadata).

### 1.4 Verification

- View source on `/bengaluru/koramangala/buy/apartment` and `/bengaluru/koramangala/buy/apartment/3bhk`: visible `<p>` text not present before change.
- `pnpm -w typecheck`
- Optional: small unit tests for `browseSeoCopy.ts` (2–3 segment depths).

---

## Phase 2 — Related locality & facet links (“nearby”)

Inside `browseSeoCopy.ts` (or a sibling `browseSeoRelatedLinks.ts`):

| Page depth | Suggested `relatedLinks` |
|------------|---------------------------|
| `/{city}/{area}` | Same area: `…/buy/apartment`, `…/rent-lease/apartment`, `…/buy/house`; plus **other areas** in city (up to 8, exclude current) → `buildBrowsePath({ cityName, areaName: other })` |
| `/{city}/{area}/buy/apartment` | Facets `1bhk`…`3bhk` (or top 3 by inventory later); parent `/{city}/{area}`; 3–5 sibling areas |
| `/{city}/{area}/buy/apartment/3bhk` | Parent category path; other BHK facets; sibling areas |
| `/{city}/buy/apartment` (no area) | Top areas by **caller-provided** `cityAreas` order (curated seed order is fine for v1) |

**Data:** `cityAreas` is already fetched in `[city]/[[...rest]]/page.tsx` — no new BFF endpoint for v1.

**Out of scope v1:** True geographic “nearby” (Koramangala → HSR) unless we add adjacency metadata to `Area` later.

---

## Phase 3 — Richer `generateMetadata` descriptions

**File:** `apps/web/src/app/[city]/[[...rest]]/page.tsx` — browse branch of `generateMetadata`.

Replace:

```ts
const description = `Browse ${heading.toLowerCase()} on Bhavano.`;
```

With a **meta-specific** string from `browseSeoCopy.ts` (e.g. `buildBrowseMetaDescription(...)`):

- 150–160 characters target.
- Include city, area (if any), category, facet, and listing count when `total` is available.

**Challenge:** `generateMetadata` currently does not fetch listing totals (extra BFF call). Options:

1. **Recommended:** Add a lightweight `fetchListings({ …, limit: 0 })` or BFF `count`-only query if one exists; if not, `limit: 1` + use `total` from existing list response shape.
2. **Fallback:** Description without count if fetch fails.

Keep **title** logic unchanged (pagination suffix already handled).

---

## Phase 4 — Discovery prerequisites (from sibling plan)

Ship in parallel or just before Phase 1–3 so crawlers find hubs faster:

| Item | Plan doc |
|------|----------|
| `SearchSuggestions` above the fold | [`seo-remaining-improvements.md`](./seo-remaining-improvements.md) Phase 1 |
| Sitemap: all cities/areas + facets | [`seo-remaining-improvements.md`](./seo-remaining-improvements.md) Phase 3 |
| Listing detail footer | Phase 4 there |

This locality-content plan **does not block** on those but **benefits** from them.

---

## Phase 5 — Measurement & iteration (ops)

1. **Search Console** — Performance filter: pages containing `/bengaluru/` (and other top cities). Track impressions after deploy.
2. **Query report** — Identify queries with impressions but low CTR; tune templates for those patterns (e.g. “flat” vs “apartment” wording).
3. **No GSC →** still ship; measurement waits on Phase 0 in [`seo-remaining-improvements.md`](./seo-remaining-improvements.md).

---

## Phase 6 — Optional v2 (explicit price long-tail)

**Not in v1** — conflicts with canonical policy for `?maxPrice=`.

If product wants “apartments in Whitefield under 1 crore” as a **rankable** URL:

- Add a **small curated map** (e.g. in code or admin JSON) of `{ area, category, maxPrice, slug }` → static paths like `/bengaluru/whitefield/buy/apartment/under-1-crore` with **self-canonical** paths and unique intro copy.
- Requires new segment parsing or dedicated static routes — separate design; do not spawn combinatorial price×area URLs automatically.

---

## Files touched (summary)

| Phase | Files |
|-------|--------|
| 1–2 | `browseSeoCopy.ts` (new), `BrowseSeoIntro.tsx` (new), `BrowseListingsView.tsx` |
| 3 | `[city]/[[...rest]]/page.tsx` (`generateMetadata` + optional count fetch) |
| 4 | `SearchSuggestions.tsx`, `sitemap.ts`, etc. (other plan) |

No Prisma/BFF schema changes for v1.

---

## Suggested PR order

1. **PR A:** `browseSeoCopy.ts` + tests + `BrowseSeoIntro` + `BrowseListingsView` (Phases 1–2).
2. **PR B:** Metadata descriptions + listing count in `generateMetadata` (Phase 3).
3. **PR C:** `SearchSuggestions` + sitemap (from [`seo-remaining-improvements.md`](./seo-remaining-improvements.md)) — can merge before or after A/B.

---

## Verification checklist

- [ ] `/bengaluru/koramangala/buy/apartment`: H1 unchanged; 1–2 intro `<p>`s; related links include other areas + facet paths.
- [ ] `/bengaluru/koramangala/buy/apartment/3bhk`: copy mentions 3 BHK; canonical unchanged.
- [ ] `?minPrice=` variant: canonical still clean path; intro still renders (filters active).
- [ ] `?page=2`: no duplicate intro wall of text (intro only page 1).
- [ ] View source: links are real `href`s, not `onClick`.
- [ ] `pnpm -w typecheck`

---

## Non-goals

- Auto-generating thousands of AI paragraphs per URL.
- Indexing every filter combination.
- Replacing the homepage discovery model.
- Paid search / ad copy (orthogonal).
