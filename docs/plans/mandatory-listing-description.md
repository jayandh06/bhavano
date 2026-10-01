# Listing description: mandatory, at least 50 characters

## Status: implemented 2026-10-01, not yet deployed

## Request

> "Make Listing description mandatory atleast 50 chars"

## What changed

`DESCRIPTION_MIN_LENGTH = 50` added next to the existing `DESCRIPTION_MAX_LENGTH` in
`packages/types/src/listingLimits.ts` — one shared constant, same pattern as `TITLE_MIN_LENGTH`.

- **`CreateListingInput.description`**: `string | undefined` → `string` (required). BFF
  `CreateListingDto.description` dropped `@IsOptional()`, gained `@MinLength(DESCRIPTION_MIN_LENGTH)` —
  mirrors exactly how `title` is already validated there.
- **`UpdateListingInput.description`**: stays optional (PATCH semantics — omitting it means "don't
  touch"), but gained `@MinLength(DESCRIPTION_MIN_LENGTH)` for when it *is* sent, same as `title`'s
  own update-time treatment. `AdminUpdateListingDto` inherits this unchanged.
- **Posting wizards** (web + mobile `PostAdWizard.tsx`): description added to the step-validation
  function that already gates Preview/Publish for title/city/area/price/photos (`detailsIssue`),
  in form order right after area. Label marked required (web), helper copy changed from "Optional,
  but ads with a description get more responses" to "At least 50 characters — ads with a real
  description get more responses."

## The real risk: edit forms always resent `description`

Three edit forms (web `EditListingForm.tsx`, mobile `my-listings/[id]/edit.tsx`, admin
`AdminEditListingForm.tsx`) all **unconditionally** included `description: description.trim()` in
every save payload, regardless of whether the owner touched that field. Combined with the update
DTO's new `@MinLength(50)`, that would have made *any* edit — changing just the price, say —
reject outright for every listing that currently has no description or a short one, since
`@IsOptional()` only skips validation for `undefined`/`null`, not an empty string.

Fixed in all three forms with the same pattern `attributes`/`price` already use in these files:
track the initial value, only include `description` in the payload when it actually changed
(`descriptionChanged`), and surface a `descriptionIssue` inline message (disabling Save) only once
it's been touched and is still under 50 characters. A legacy listing's short/missing description is
left alone until its owner (or an admin) chooses to edit it — consistent with how `title`,
`attributes` and brokerage checks already behave in these same forms.

## Database: still nullable

`Listing.description String?` in the schema is untouched. Same reasoning as every other
"mandatory from now on" field in this codebase (`SavedSearch.cityId`/`minPrice`/`maxPrice` from
the day before this): existing rows with no/short description aren't migrated or backfilled, and
nothing here blocks reading or displaying them. The rule is enforced only where a description is
actually being set — on create, always; on update, only when the field is present in the request.

## The one system-generated creation path with no description

`OutreachService.createListingFromContact()` builds a listing from a scraped Google Places
business contact (PG/coworking leads) with no description at all — title is just the business
name. Since `CreateListingInput.description` is now required, this needed a real value. Added a
short, genuinely-true generated sentence ("`{name}` is a PG accommodation listed on Bhavano.
Contact the lister for full details on availability, sharing options and amenities.") — same
"claiming owner corrects it later" philosophy this function already uses for its attribute
defaults (seatType, parking, etc.), not a placeholder that reads as broken to a buyer browsing it
before the owner claims it.

`bulk_upload_listings.py` (CSV-driven bulk import) was **not** changed — it already only includes
`description` in its payload when the CSV row has one. A row without one will now get a real BFF
rejection instead of silently creating a description-less listing, which is the new rule working
as intended for a human-curated import, not a bug to route around.

## e2e tests updated

Two Playwright specs that drive the posting wizard all the way to "Preview Ad" —
`post-ad-preview-back.spec.ts` and `post-ad-draft-photo-restore.spec.ts` — never filled in a
description, so the Preview button's enabled-state assertion would now time out. Both updated to
fill a real description before asserting Preview is enabled. `post-ad-city-default.spec.ts` and
`residential-details.spec.ts` only exercise the details step and never reach Preview, so they
didn't need a change.

## Verification

- BFF: `tsc --noEmit` clean, full jest suite (692 tests, one pre-existing unrelated jwks-rsa/ESM
  suite failure) passes, including `outreach.service.spec.ts`'s `objectContaining` assertions
  (unaffected by the new `description` field being present).
- Web, admin: `tsc --noEmit` and eslint clean on every touched file.
- Mobile: eslint isn't configured for this app; `tsc` crashes with a pre-existing, unrelated stack
  overflow in this TypeScript/codebase combination (confirmed pre-existing during an earlier,
  unrelated copy-only change the same day) — verified by careful manual mirroring of the
  already-working web pattern instead.
- **Not verified**: a live run of the updated e2e specs. The local BFF dev server (and its
  database) wasn't running in this environment, so `pnpm exec playwright test` only got as far as
  the auth setup step before failing on a connection error unrelated to this change. Worth running
  for real before merging, with `pnpm dev` up in both `apps/web` and `apps/bff`.

## Not doing

- No backfill/migration for existing short-or-missing descriptions.
- No change to `bulk_upload_listings.py`'s behavior — a missing description in a CSV row should
  fail loudly now, not be silently patched over.
