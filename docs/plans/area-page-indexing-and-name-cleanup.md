# Area page indexing rule and area-name cleanup

## Problem
Production has about 800 area pages in the sitemap, but most areas have one to three active
listings, and many "areas" are free-text addresses (a pin code, "Shiv vihar gali no.1 …", an area
named after its own city). `LocationsService.ensureArea` created an area from whatever was typed.
Each one became an indexable URL and a page title: many thin pages, some with junk names.

## Changes
1. **Minimum-listing rule** (`apps/web/src/lib/seoIndexing.ts`, `MIN_INDEXABLE_AREA_LISTINGS = 2`).
   A plain area page (`/{city}/{area}`) with fewer active listings is `noindex, follow` and is left
   out of `sitemap.xml`. It still works for visitors and passes link equity, and becomes indexable
   again on its own when the area reaches the threshold. Category and facet pages are unchanged
   (the existing zero-listing `noindex` still applies). The sitemap and the page metadata share
   the one constant so they cannot disagree.
2. **Name cleanup at the source** (`apps/bff/src/locations/area-name.ts`, used by `ensureArea`):
   drops pin codes, collapses whitespace, refuses a name over 60 characters (asks for the locality,
   not a full address). A comma is kept: "Sector 30, Kharghar" is a real name.
3. **Find the existing junk**: `apps/bff/scripts/suspicious-areas.sql` (read-only) lists areas that
   are the city's own name, contain a pin code, are over 40 characters, start lowercase or look
   like an address, with listing counts. Merge or rename those by hand; no data is changed here.

## Effect to expect
Roughly 800 area URLs drop to the few dozen with two or more listings. That is intended, not a
loss: the removed pages had almost nothing on them. Watch Search Console "Indexed pages" and
impressions on `/{city}/{area}` URLs over the next weeks. If a useful area is noindexed, lower the
threshold or grow its inventory.

## Not done
- Merging existing junk areas (needs a person to choose the right locality for each).
- Raising the threshold to 3: revisit when inventory grows.
