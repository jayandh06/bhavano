## Plans & Research

For any planning or research task, create, save, and reference files within the `docs/plans/` folder.

## SEO Requirements

Any change to routing, rendering strategy, or component structure MUST preserve SEO performance. Before implementing, check:

- **Don't convert SEO-relevant Server Components to Client Components** unnecessarily. Marking a page/layout `"use client"` removes it from server-rendered RSC output and can affect how crawlers see initial content — only add `"use client"` to the smallest possible leaf component that actually needs interactivity, not to parent pages/layouts.
- **Preserve metadata exports** (`generateMetadata`, `metadata` object, title, description, canonical URLs, Open Graph tags) on all routes. Don't remove or accidentally shadow these when refactoring.
- **Keep critical content server-rendered.** Don't move above-the-fold or crawlable content (headings, product/trading data, key copy) into client-only fetches (`useEffect` + `fetch`) — this hides content from crawlers until JS executes. Prefer Server Components or SSR data fetching for anything crawlers should index.
- **Don't break URL structure** — no unannounced route renames, redirects, or slug changes without 301s in place.
- **Preserve structured data / JSON-LD** if present (e.g. for trading products, articles) — don't strip it during component refactors.
- **Check Core Web Vitals impact** — avoid changes that bloat client JS bundles (e.g. converting Server Components to Client unnecessarily increases hydration cost and can hurt LCP/INP scores, which are ranking factors).
- **robots.txt / sitemap.xml** — don't modify these without explicit confirmation; accidental `noindex` or disallow rules can deindex pages.

## URL consistency

URLs are a public interface: people bookmark and share them, and crawlers index them. Keep them
readable and stable.

- **Never put a database id in a URL.** Use the slug — `slugify(city.name)`, not `city.id`. A cuid
  is unreadable, unshareable, and couples a bookmarked link to a row id that a reseed invalidates.
  This applies to query params as much as to paths: `?city=bengaluru`, never
  `?city=cmrkwg8gk00004qquau1sbbim`.
- **Prefer a path over a query param** where the page is meant to rank — `/bengaluru/buy/apartments`
  rather than `/?city=…&category=…`. Query params are for filtering a page that already exists at
  its own address, not for identifying which page you are on.
- **A query-param variant of a rankable page must set a canonical** back to the plain route, as
  `app/page.tsx` does with `alternates: { canonical: "/" }`. Without it the same content competes
  with itself across every filter combination.
- **When changing how a URL is built, keep the old form resolving.** Accept the previous shape as a
  fallback (the homepage still resolves `?city=<id>` for links shared before it emitted slugs) or
  add a 301. Links already exist in the wild; a link that silently falls back to a default is worse
  than one that errors, because nobody notices.
- **Be consistent across the app.** If one route says `?city=<slug>`, all of them do. A single
  divergent builder is how `?city=<cuid>` survived alongside `/post?city=bengaluru`.

**Rule of thumb: if a change affects a page a user or crawler would land on directly (not an authenticated dashboard view), flag the SEO impact before making it.**