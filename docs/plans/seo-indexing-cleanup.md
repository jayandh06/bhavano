# Search Console indexing cleanup (2026-10-27)

Status: built 2026-10-27, deployed the same day. Related: [`area-page-indexing-and-name-cleanup.md`](area-page-indexing-and-name-cleanup.md), [`seo-locality-landing-content.md`](seo-locality-landing-content.md),
[`seo-all-cities-footer-links.md`](seo-all-cities-footer-links.md).

## The report (Search Console, page indexing, last update 23/10/2026)
Indexed 7.15K, not indexed 4.91K. Reasons: excluded by noindex 2,459; page with redirect 633; not found (404) 81; alternative page with proper canonical 66; discovered, not indexed 416; crawled, not indexed 256;
duplicate, Google chose a different canonical 56; blocked by robots.txt 434; soft 404 415; duplicate without user-selected canonical 98.

## What is by design (no fix)
- **noindex 2,459:** a city, category or bedroom page with no listings returns 200 with `noindex, follow` (tested: `/ludhiana/rent-lease`), and a plain locality page with fewer than 2 listings does the same (`isThinAreaPage`). Do not click "Validate fix" on this reason; it will keep failing, correctly.
- **blocked by robots.txt 434:** `/post`, `/favourites`, `/my-listings`, `/messages`, `/profile`, `/auth`, including every `/post?from=...` variant.
- **redirect 633, 404 81, canonical 66:** legacy URL forms, removed listings, filter variants (`?sort=`, `?areas=`) that canonicalize to the main page.

## What caused the waste, and what was fixed
1. **"Explore nearby" links pointed at empty pages.** `browseSeoCopy.ts` builds up to 12 related links per browse page from lists (the first areas of the city, every bedroom count) without looking at inventory. Crawling `/pune/rent-lease/apartment`
   showed links to `/pune/rent-lease/apartment/4bhk`, `/5bhk` and area pages with no matching listings, all `noindex`. Those links are how Google discovered most of the thousands of empty URLs behind "noindex", "discovered, not indexed" and the soft 404s.
   **Fix:** `BrowseSeoIntro` now keeps only links whose target has at least one listing (and, for a plain area page, the minimum area count). The data is the sitemap's own listing list, cached 10 minutes (`lib/linkInventory.ts`, `fetchListingInventory`); if it cannot be read, all links are kept.
2. **`<lastmod>` was never honest.** A listing's `updatedAt` moves whenever a view, like or boost rotation touches the row, and hub pages and static pages said "modified now" on every request, so Google learns to ignore the date.
   **Fix:** the sitemap now uses the last real content change (posted, or an `updated` edit-log entry); hub pages use the newest listing under them; static pages omit `lastmod`. The sitemap entries also carry `bedrooms`, used for the link filter.
3. **The ad display path `/rent/<city>` and `/buy/<city>` was a 404.** The path shown in the ad (`www.bhavano.com/rent/bengaluru`) is not a link, but anyone typing it hit a dead page. It now 308s to `/<city>/rent-lease` or `/<city>/buy`.

## Still open (needs examples from Search Console)
- **Soft 404, 415:** open the report and copy 5 to 10 example URLs. Likely candidates are closed or near-empty pages.
- **Duplicate, Google chose a different canonical (56) and without user-selected canonical (98):** need examples; query-string variants are the usual cause.
- **Crawled, not indexed (256) and discovered, not indexed (416):** quality and link signals. Fewer links to thin pages (item 1) helps; backlinks and richer locality text help more.

## Check in 2 to 4 weeks
Search Console > page indexing: "Excluded by noindex" and "Discovered, currently not indexed" should shrink as Google recrawls (it does not drop URLs it already knows quickly). Indexed pages should not fall. Compare against 7.15K indexed, 4.91K not indexed.
