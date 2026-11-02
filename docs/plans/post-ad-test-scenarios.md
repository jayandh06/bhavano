# Admin test scenarios for the post-ad flow

## Why

Trying each category, transaction type and edge case of `/post` (and then the Featured offer on the success screen) meant filling the
whole form by hand every time, photos included. Admins now pick a ready-made ad and land on the Preview step in one click.

## What it does

On `/post`, logged in as an admin, the category and details steps show an **Admin: test scenarios** panel (`AdminTestScenarios.tsx`).
Choose a scenario and press **Fill and open preview**:
- the category, transaction type, price (and qualifier), every visible attribute, title and description are filled;
- three different JPEGs are drawn in the browser, so no files are needed (and the duplicate-photo check sees distinct images);
- the pin goes at the centre of the city the page is showing, and the area comes from the same reverse-geocode lookup a dropped pin uses;
- the Featured choice is left empty, so **Post ad** publishes at once (no payment starts) and the **success screen shows the Featured
  offer** (the "make featured" page), where the real picker and checkout can be tried;
- the form opens on **Preview**.

Scenarios (`lib/postAdScenarios.ts`): every postable category and transaction type once as a standard ad (about 25), plus edge cases on
common ones: only required fields (apartment rent, apartment sale, plot, PG), the longest title and description, the highest and the
lowest allowed price. Attributes are generated from `CATEGORY_FIELD_CONFIG` (the first option of each select, small numbers, rupee
amounts scaled to the price), so a new field is filled without editing the scenarios.

## Cleanup

Posting creates a **real, live listing** titled `[TEST] ...`, owned by the admin who posted it. It is not hidden from public search.
The admin **Listings** screen shows a "N test ads" bar with a **Remove test ads** button whenever any exist (`RemoveTestAds.tsx`). One
confirmed click hard-deletes them all, with the same photo and video cleanup as deleting a single listing (`GET/DELETE /admin/test-ads`,
`AdminService.countTestAds` / `deleteTestAds`, at most 500 per click; one failure does not stop the rest and is reported). Only ads that
are **both** titled `[TEST]...` **and** owned by an admin are matched, so a real user's ad can never be removed this way.

## Checks

`lib/postAdScenarios.test.ts` runs every scenario through the form's own validators (`listingAttributeIssues`, `listingPriceIssue`,
the title and description limits), so a scenario cannot drift out of step with the form. The panel itself was not clicked through with
an admin login when it shipped.

## Not done

Mobile app; filling a different city than the one on screen.
