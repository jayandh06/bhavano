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

## Follow-up (2026-10-21): presets and page buttons now submit the filter form

After the fix above the admin still reported that "1 day / 7 days" and the page numbers only took effect after pressing
**Apply filters** first. Apply is a native GET form submit and always works; the presets and page numbers were
client-side `<Link>` navigations built from the URL, so they could only carry filters that had already been applied
and they depend on Next's client router (soft navigation) behaving. Both problems go away if they submit the form
like Apply does.

- `Pagination` takes an optional `formId`; with it, page numbers / Prev / Next are `<button type="submit" form=… name="page"
  value=N>` that submit the screen's filter form, so unapplied filters (a typed Title, a changed status, custom dates)
  come along. Listing moderation passes `formId="moderation-filters"`. Other screens keep their links until they adopt it
  (add an `id` to their form and pass `formId`).
- `DateRangeFilter` presets are buttons that fill the date fields of the surrounding form and `requestSubmit()` it
  (falling back to the old link only if there is no form). The pressed pill shows as selected with an ellipsis until the
  page reloads. The preset still resets to page 1 because `page` is not a form field.
- Trade-off: these are full page loads (as "Apply filters" already was), not soft navigations, and they drop the
  `__skipRemember` marker the same way Apply does.

Verified locally (real admin app, test session, fake data service): with "unapplied-title" typed, page 2 sent
`search=unapplied-title&offset=25`; with "typed-before-preset" typed, "7 days" sent `createdFrom=2026-10-15` plus the
typed search and reset to offset 0.
