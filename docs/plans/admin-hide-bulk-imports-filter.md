# Admin Listing moderation: "Bulk imports" filter

## Status: built and committed (2026-10-21); needs a BFF + admin deploy

## What it is

A **Bulk imports** select in the Listing moderation filter bar (admin `/`):

| Option | Shows |
|---|---|
| Show all (default) | everything, as before |
| Hide bulk imports | everything except bulk imports |
| Only bulk imports | just the bulk imports |

It is a URL param (`bulkImport=exclude|only`), so it survives Apply, pagination, sorting, tab switches and the
remembered-filters cookie like every other filter.

## What counts as a bulk import

A listing **still owned by the system Bulk Import account** (`phone = 9000000002`, `apps/bff/src/listings/bulk-import-owner.ts`):
what `bulk_upload_listings.py` and `OutreachService.createListingFromContact` create until the business claims it.

- **Admin-assisted listings awaiting claim are NOT counted as imports.** They are owned by the same account but are a
  different thing (hidden until the seller claims them), so they stay visible under "Hide bulk imports" and stay out
  of "Only bulk imports"; the "Awaiting claim" tab keeps working with the filter on.
- **Once a business claims an imported listing it stops being a bulk import** (ownership moves to a real user), so it
  reappears under "Hide bulk imports". The `Claimed via` column still shows how it was claimed.

## Implementation

- BFF: `ListAdminListingsDto.bulkImport` (`BULK_IMPORT_FILTERS`), applied in `ListingsService.listForAdmin`.
  "only" = `owner.phone = BULK` and `publishState != awaiting_claim`. "exclude" is written as positive conditions
  (`owner.phone != BULK` OR `owner.phone IS NULL` OR `publishState = awaiting_claim`), because a plain NOT would also drop
  listings whose owner has no phone (39 today).
- Admin: `AdminListingsQuery.bulkImport`, the select on the page, and `bulkImport` added to the table's
  `LISTINGS_FORM_OWNED_PARAMS` so Apply does not submit it twice.
- Tests: three cases in `listings.service.spec.ts` (exclude, only, not given).

## Verified

Production, using the real Prisma queries read-only: 898 listings in total; **Only = 330**, **Hide = 568**, and 330 + 568
= 898 (nothing lost or double counted). A naive "owner is not the bulk account" would have given 529, silently dropping
the 39 listings whose owner has no phone. Locally, selecting "Hide bulk imports" and applying sent `bulkImport=exclude`,
and page 2 kept it.

## Not changed

Only Listing moderation has this filter. Other screens (Listing performance, Users) do not. The default stays "Show
all"; if you want imports hidden by default, change the default in `app/page.tsx` (note the page already defaults the
created date to one day, so imports created today would be the first thing hidden).

## Update 2026-10-21: bulk imports are now hidden by default

The first version defaulted to "Show all", so the queue still opened full of imports and the admin kept asking for them
to be filtered out. The page now opens with **Hide bulk imports**; the select's options are **Hide bulk imports** (default),
**Show all**, **Only bulk imports**.

- "Show all" is a real URL value (`bulkImport=all`), not an empty one: this screen's links (page numbers, tabs, sort) drop
  empty params, so an empty "show all" would silently fall back to the hide default on the next page. An absent or
  unknown value means hide. Logic and tests: `apps/admin/src/lib/bulkImportFilter.ts` / `.test.ts`.
- No BFF change: the data query still takes `bulkImport=exclude|only`; "all" sends nothing.
- Anyone with a remembered filter from before (no `bulkImport` in it) now gets the hide default too.
- The "Awaiting claim" tab is unaffected (admin-assisted listings awaiting claim are never counted as imports).
- Verified locally with the real admin app and a fake data service: arriving with no param sent `bulkImport=exclude`,
  choosing Show all sent none, and page 2 after Show all still sent none.
