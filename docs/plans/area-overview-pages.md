# Area overview content on area landing pages

Builds on [`seo-locality-landing-content.md`](seo-locality-landing-content.md).

## Decision
Overview content lives **on the existing area URL** (`/{city}/{area}`, e.g. `/bengaluru/koramangala`),
below the listing grid. No new URL: a separate guide page would compete with the area page for the
same searches. Category and facet pages are unchanged.

## Update (2026-10-18): moved to the database, with an admin review page

The text no longer lives in `apps/web/src/lib/areaOverviews.ts` (deleted). It is in the
`AreaOverview` table (one row per area, `status` = draft / in_review / published) and is written,
reviewed and published in the admin app under **Area overviews** (`/area-overviews`).

- **Public read:** `GET /area-overviews/:areaId` returns only a *published* row. The web page
  (`AreaOverview.tsx`, server-rendered) fetches it with `revalidate: 3600`, null results included,
  so an area without one costs no BFF call per view. Publishing reaches the site within about an
  hour.
- **Admin:** `GET/PUT /admin/area-overviews`, `PATCH /admin/area-overviews/:areaId/status`
  (all behind `AdminGuard`). The list shows every area with listings, busiest first, with status
  and reviewer. The editor has live automatic checks, a five-item review checklist (all must be
  ticked to publish), a preview, and Save draft / Send for review / Approve and publish / Unpublish.
- **Rules enforced in code** (`@bhavano/types/areaOverview`, run in the editor and again in the
  BFF): no prices, rents or percentages, no links or emails, length limits, at least one About
  paragraph and one FAQ. Editing in-review or published text sends it back to draft and clears the
  approval. Approval records who and when (the name is copied at approval time).
- **List page (2026-10-19):** sortable columns (city, area, active listings, status, updated; click
  a header to sort, click again to reverse) and filters for status, city, area name, update date range
  (India time, inclusive; areas with no text have no date, so a date filter leaves them out) and
  active-listing range. Rows with text have a checkbox; **Publish selected** opens the same
  five-item checklist (all ticked to proceed) and records the signed-in admin as approver for each
  area, skipping and reporting any area whose text fails a check. **Move to draft** unpublishes in
  bulk. Selection is per page. Bulk calls `POST /admin/area-overviews/bulk-status` (max 100 areas).
  Every dropdown in the admin now has its arrow at the far right (global `select` rule in
  `apps/admin/src/app/globals.css`).
- **First content:** the eight Bengaluru drafts live in `apps/bff/scripts/area-overview-drafts.ts`
  and are loaded as drafts by `scripts/seed-area-overview-drafts.ts` (re-runnable, never overwrites
  an existing row).
- **Rollout order:** deploy with `prisma migrate deploy` (new table only), run the seed script,
  then review and publish from the admin page.

## Pilot (built, now superseded by the above)
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
