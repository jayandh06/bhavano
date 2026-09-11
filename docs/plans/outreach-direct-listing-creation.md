# Direct listing creation from OutreachContact

Skips the CSV/`bulk_upload_listings.py` round-trip for the common case: create a real `Listing`
straight from a scraped `OutreachContact` row, using only what's actually known, on the
philosophy that **the business claiming the listing later is responsible for completing the
rest** (description, real pricing, its own photos) — not ops, and not a fabricated guess.

## Why not just relax `ListingsService.create()`'s validation?

The two things blocking "create directly" were: `create()` requires at least one photo, and
`assertValidAttributes` requires `sharingType`/`seatType`. Both exist to stop a *real poster*
publishing something half-finished — relaxing them generally would have weakened that for
everyone, not just outreach-originated listings.

Turned out neither needed relaxing at all, once real defaults exist for what's missing:

- **Sharing/seat type**: defaulted rather than left empty — `single` for pg, `hot-desk` for
  coworking (the closest match to plain "Desk" among `hot-desk`/`dedicated-desk`/`private-cabin`).
  A real string value satisfies the existing required-field check unmodified.
- **Photos**: a contact with none downloaded is refused outright (`BadRequestException`), same
  as `bulk_upload_listings.py`'s own `find_photos()` behaviour — never a photo-less listing.

So `OutreachService.createListingFromContact()` calls `ListingsService.create()` completely
unmodified — no bypass flag, no relaxed path. It just always has real values for what that method
requires.

## What's used from scraped data vs. defaulted

| Field | Source |
|---|---|
| title | `OutreachContact.name` |
| category | `OutreachContact.businessCategory` (pg/coworking only) |
| cityId / areaId / lat / lng | `OutreachContact` directly |
| photos | Local files on disk, matched by `googlePlaceId` — see below |
| `gender` (pg only) | Keyword-guessed from the name — `guessGender()` in `outreach.service.ts`, a hand-kept TypeScript mirror of `export_outreach_contacts_for_listings.py`'s `guess_gender()` (same test cases verified on both sides) |
| `sharingType` (pg) | Always `"single"` |
| `seatType` (coworking) | Always `"hot-desk"` |
| price | Always `0` ("Contact for price" — same convention as the CSV path) |
| description | Never set — left for the owner |
| `claimContactId` | The contact's own id |

## Photos: the scraper now runs on the app server, not a laptop

`get_pg_coworking_leads.py --photos-dir` downloads locally, next to wherever it's run. For this
feature to read them, the scraper is run **directly on the app instance via SSH** (manually — no
admin-triggered scraping was built; that's still a separate, larger, deferred feature), writing
into `~/bhavano/leads_output/photos/`. `docker-compose.prod.yml` bind-mounts that directory
read-only into the `bff` container at `SCRAPED_PHOTOS_DIR` (`/app/leads_output/photos`).
`findLocalPhotos()` matches files by the exact `{googlePlaceId}_{i}.jpg` naming
`download_photos()` already uses, capped at 6, sorted.

Uploading them to R2 reuses the same three pieces `UploadsController.upload()` uses per file —
`computeDHash`, `extFromMimeType`, `R2StorageService.putObject` under `originalKey(listingId,
photoNo, ext)` — just driven from local disk instead of a multipart request.

## Admin surface

`apps/admin/src/components/OutreachContactsList.tsx` — a "Create listing" bulk action alongside
the existing "Send claim verification" one (see the claim-verification plan/work earlier this
session). A contact is eligible for exactly one of the two at a time:

- **No listing yet** (`!hasListing`) → "Create listing"
- **Has an unclaimed listing** (`hasClaimableListing`) → "Send claim verification"
- **Already claimed** → neither

Both call the existing per-contact endpoints in a sequential loop (not parallel), same reasoning
as the claim-verification bulk action: don't burst photo uploads / MSG91 / SMTP all at once for a
large selection.

## Explicitly out of scope here

- **Triggering the scrape itself from the admin app.** Still manual, via SSH. A background-job
  UI for this was scoped and deferred earlier in the same conversation this plan comes from.
- **A public-facing "details pending" note** on a listing created this way. Considered and
  dropped once sharing/seat-type and gender all ended up with real values — the only genuinely
  missing thing is the description, which doesn't need special-casing in the UI.
- **CSV pipeline removal.** `bulk_upload_listings.py`/`export_outreach_contacts_for_listings.py`
  are untouched and still available for a fuller, hand-curated bulk upload if that's ever wanted
  instead.
