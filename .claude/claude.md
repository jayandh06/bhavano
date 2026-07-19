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

**Rule of thumb: if a change affects a page a user or crawler would land on directly (not an authenticated dashboard view), flag the SEO impact before making it.**