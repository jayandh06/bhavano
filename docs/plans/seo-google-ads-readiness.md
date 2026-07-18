# SEO completeness + Google Ads readiness

## Context

Recent work already gave this site the structural backbone of good SEO: a clean city-first URL
hierarchy (`/{city}/{transactionGroup}/{category}/{facet}/{locality}/{slug}-{id}`), a real
`sitemap.xml`, and a `robots.ts`. What was still missing was everything layered *on top* of that
structure — per-page Open Graph/Twitter metadata, canonical tags (needed since filtered query
strings can create near-duplicate variants of the same clean page), structured data (JSON-LD) for
rich snippets, image optimization, a branded 404, and — for Google Ads specifically — conversion
tracking, since Ads can't measure results without it. This closes those gaps.

**Confirmed decisions:**
- **Analytics = Google Tag Manager** (one container script; GA4/Ads conversion tags configured
  later from the GTM dashboard without another code deploy).
- **Migrated listing photos to `next/image`** (ListingCard, ListingDetailView) — a genuine Core
  Web Vitals win that affects both organic ranking and Ads Quality Score's landing page experience
  factor.
- **Google Search Console verified via a DNS TXT record** (no code change — a manual Cloudflare DNS
  step, documented alongside the existing DNS setup in `docs/deployment.md`).

## Metadata: Open Graph/Twitter cards + canonical tags everywhere

- `apps/web/src/app/layout.tsx`: added `metadataBase` (from `NEXT_PUBLIC_SITE_URL`), sitewide
  `openGraph`/`twitter` defaults (site name, locale `en_IN`, type `website`), and default `robots`
  directives — every page inherits these unless it overrides them.
- `apps/web/src/app/[city]/[[...rest]]/page.tsx`'s `generateMetadata`: extended to also return
  `openGraph.title/description`, an `openGraph.images` entry (the listing's first photo on detail
  pages), and `alternates: { canonical: <clean path via buildListingPath/canonicalBrowsePath> } }`.
  This makes `?minPrice=X&furnished=Y` filtered variants canonicalize back to the clean unfiltered
  page, consolidating ranking signal instead of creating near-duplicate-content pages, without
  blocking crawling (canonical, not `noindex` — Google still discovers links through the filtered
  version, it just attributes ranking to the clean one).
- `apps/web/src/app/page.tsx` (homepage): added `alternates: { canonical: "/" }` — the homepage's
  own query-string filtering is a UX convenience, not meant to rank separately per combination the
  way the dedicated city pages are.
- Static pages (`terms`, `privacy`, `contact`, `help`): added one-line `description`s alongside the
  existing `title`s (cheap SERP-snippet/CTR improvement).

## Structured data (JSON-LD)

New reusable component, `apps/web/src/components/JsonLd.tsx`, rendering a
`<script type="application/ld+json">` from a plain object (no library needed).
- **Organization** schema once, in the root layout.
- **BreadcrumbList** schema on every resolved page in `[city]/[[...rest]]/page.tsx` — built directly
  from the already-parsed segments (`ParsedSegments` from `seoRoute.ts`'s city → transactionGroup →
  category → facet → locality chain).
- **Product**-shaped schema (schema.org's real-estate-listing convention: `Product` +
  `offers.price`/`availability`) on the listing-detail branch — price (converted from the DTO's
  formatted `"₹85,00,000"` string back to a raw numeric string), image, category. This is what
  unlocks rich snippets in organic search and gives Google Ads' Dynamic Search Ads/Dynamic
  Remarketing something structured to read off the page.

## `next.config.ts` + `next/image` migration

- `next.config.ts`: added `images.remotePatterns` allowing the R2 CDN host (`cdn.bhavano.com`,
  hardcoded rather than read from an env var — `next.config.ts`'s `images` option resolves at
  build time and this app's Docker build doesn't currently pass `NEXT_PUBLIC_*` vars as build args).
- Replaced `<img>` with `next/image`'s `<Image>` in `ListingCard.tsx` and `ListingDetailView.tsx`
  (real CDN-served photos — `fill` on a sized parent for the card thumbnail and hero image,
  explicit `width`/`height` for the thumbnail strip, `priority` on the hero for LCP, default
  lazy-loading elsewhere, `sizes` hints for responsive srcset). The wizard's client-side blob
  previews (`URL.createObjectURL`, pre-upload, not indexed content) stay as plain `<img>` —
  `next/image`'s optimizer can't (and doesn't need to) touch local blob URLs.

## Analytics — Google Tag Manager

- Root layout gained the GTM loader script (`next/script`, `strategy="afterInteractive"`) plus the
  `<noscript>` iframe fallback immediately after `<body>` — standard GTM install pattern, gated
  behind a new `NEXT_PUBLIC_GTM_ID` env var (absent locally, so the script correctly doesn't load
  in dev).
- A small `pushDataLayerEvent(event, data)` helper (`apps/web/src/lib/gtm.ts`), wired into two
  meaningful existing actions so GTM has real signals to build Ads conversion triggers on later
  without another deploy:
  - **`contact_owner`** — fired client-side in `ListingDetailActions.tsx` right before navigating
    to the new conversation.
  - **`post_ad_success`** — fired via a `PostSuccessTracker` client component, mounted on the
    listing-detail page and gated on a `?posted=true` query param that `createListingAction`
    appends to its `redirect()` target. (A server action's `redirect()` throws a Next.js signal, so
    client code placed after an awaited server action never runs on success — the query-param +
    mount-effect tracker is the standard workaround, mirroring the existing `ViewTracker.tsx`
    pattern.)

## Robots + 404

- `apps/web/src/app/robots.ts`: added `/my-listings` and `/profile` to the existing disallow list
  (account-specific, not indexable content) alongside `/post`, `/favourites`, `/messages`.
- New `apps/web/src/app/not-found.tsx` — a branded 404 (matches the site's look, links back to the
  homepage and a couple of popular category pages) instead of Next's bare default. Title is just
  `"Page not found"` (not `"Page not found — Bhavano"`) since the root layout's title template
  (`%s — Bhavano`) already appends the site name — an early version double-appended it.

## `docs/deployment.md`

Added a new "SEO: Search Console verification + analytics" section: the Search Console DNS TXT
verification step (same style as the existing DNS instructions for the four subdomains), and
`NEXT_PUBLIC_GTM_ID` documented as a new env var (also added to `.env.production.example` and
`docker-compose.prod.yml`'s `web` service — read inside the root layout Server Component, so it
only needs a plain `environment:` entry, no new Dockerfile build ARG).

## Verification (completed)

- `pnpm typecheck` — clean across all 5 packages.
- Homepage: `<link rel="canonical" href=".../">`, sitewide OG tags, and the Organization JSON-LD
  block all present.
- Listing detail page (`/bengaluru/buy/apartment/koramangala/3-bhk-apartment-in-koramangala-<id>`):
  confirmed against a currently-valid listing ID — canonical tag matches the page's own clean URL,
  `og:title`/`og:description` are listing-specific (not the sitewide default), and all of
  Organization + BreadcrumbList (4 `ListItem`s: city → buy → apartment → Koramangala) + Product +
  Offer JSON-LD render. (An earlier check against a stale, no-longer-existing listing ID incorrectly
  looked like a bug — it was `fetchListingById` correctly returning `null` and the route falling
  through to `notFound()`, which explains why *only* the generic root-layout metadata rendered.)
- Filtered browse variant (`/bengaluru/buy/apartment?minPrice=5000000`): serves 200, canonical
  correctly points at the clean unfiltered path.
- `/some-nonexistent-path`: serves 404 with the new branded not-found page (`<title>Page not
  found — Bhavano</title>`, no title doubling).
- **Not yet runnable from here** (need a live, publicly reachable deployment): GTM script/noscript
  iframe with a real container ID, Google's Rich Results Test, and PageSpeed Insights. Recommended
  as a follow-up once this ships.
