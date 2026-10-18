# Area overview content on area landing pages

Builds on [`seo-locality-landing-content.md`](seo-locality-landing-content.md).

## Decision
Overview content lives **on the existing area URL** (`/{city}/{area}`, e.g. `/bengaluru/koramangala`),
below the listing grid. No new URL: a separate guide page would compete with the area page for the
same searches. Category and facet pages are unchanged.

## Pilot (built)
- `apps/web/src/lib/areaOverviews.ts`: hand-written content per `city/area` (about, getting around,
  FAQs). Stored in code, server-rendered, versioned in git.
- `apps/web/src/components/home/AreaOverview.tsx`: renders it on the plain area page only, page 1,
  with `FAQPage` JSON-LD whose text is the same as the visible text.
- Pilot area: Bengaluru / Koramangala.
- **Nothing renders until `reviewed: true`.** The Koramangala text is a draft written from general
  knowledge; someone who knows the area must check it, then flip the flag.

## Rules for the content
- Verifiable facts only. No prices, rents or statistics typed into content; a test blocks them.
- Any figure must come from our own listings, computed live, with the listing count and date shown,
  and hidden when there are too few listings. That live block is **not built yet**.
- No claims about named shops, schools or projects that can change.

## Next steps
1. Review the Koramangala text, set `reviewed: true`, deploy, and check the page and its structured
   data in Search Console.
2. Add a BFF endpoint for median asking rent and price per area (with count and date), cached, and
   a block that shows it only above a minimum count.
3. Write 30 to 50 more areas for the cities with the most listings. Measure impressions and clicks
   on those URLs before widening.
