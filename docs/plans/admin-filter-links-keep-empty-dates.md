# Admin list screens: pagination, sort and tab links lost an emptied date range

## Status: fixed and committed (2026-10-21); needs an admin deploy

## Symptom

On Listing moderation (and the other admin list screens), changing page, sorting, switching tab or toggling columns
sometimes showed a different result set than the filters in the form, and pressing **Apply filters** once made it right.

## Cause

Several admin screens apply a **silent default window** when a date param is *absent*: Listing moderation defaults
`createdFrom`/`createdTo` to the last day (`app/page.tsx`), and other screens do the same for `from`/`to`. An **empty**
value (`?createdFrom=&createdTo=`, which is what "Apply filters" sends after the admin clears the dates) is the
deliberate way to say "no date limit".

Every link built from the current filters (`buildPageHref`, `buildSortHref`, `buildSuffixSortHref`, the tab links,
the column toggle, the date presets, the page-size form) copied only **non-empty** params. So with "no date limit" in
force, page 1 was unlimited but the page 2 link had no date params at all, and the server applied the one-day default:
page 2 showed a different (much smaller) set than page 1. Apply filters submits the empty date inputs again, which is
why it "fixed" it.

Reproduced locally with the real admin app, a signed-in test session and a fake data service: with
`/?createdFrom=&createdTo=&tab=all`, page 2 sent `createdFrom=2026-10-21` (the default) instead of no range.

## Fix

`lib/searchParams.ts` gets one rule, `carriedValue(key, value)`: keep a value, keep an **emptied date-range param**
(`from`, `to`, `*From`, `*To`), drop any other empty param. All the link builders and hidden-field copies use it
(`buildPageHref`, `buildSortHref`, `buildSuffixSortHref`, `app/page.tsx` tab links, `page-visits` traffic links,
`referrals`, `AdminListingsTable` column toggle/reset/carried fields, `DateRangeFilter` presets, `Pagination` size form).
Other empty params are still dropped, so URLs only grow by the two date params. Covered by `lib/searchParams.test.ts`.

Verified in the browser after the fix: page 2 and sort links keep `createdFrom=&createdTo=`, and the data service
receives no date range for page 2.

## Not changed / noticed

- Once "Custom" is opened, the date inputs stay mounted across link navigations and are uncontrolled, so after
  clicking a preset their displayed value can lag the URL; the next "Apply filters" would then submit the stale value.
  Not reproduced as a real problem here and not changed.
- A click made before the page finished loading once failed to move to page 2 in my local run and could not be
  reproduced again (three further attempts, including an immediate click, worked).
