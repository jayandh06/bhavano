# PG / coworking lead-gen scraper (Google Places API)

## Goal

A standalone Python script, run manually from a dev machine, that takes a list of cities and
produces a CSV of PG and coworking-space businesses in each city — for a sales/ops team to call
and onboard as sellers on Bhavano. Not wired into the app or DB; output is a flat file.

## Why Python, why standalone

Matches the existing root-level automation scripts (`ads_report.py`, `gtm_audit.py`,
`msg91_list_templates.py`, `whatsapp_test_send.py`) — same `.env`-driven config pattern, same
"run it yourself when you need data" usage model. No coupling to `packages/types` or the listing
schema, since this isn't meant to feed automated listing creation (see Non-goals).

## API

**Google Places API — Text Search + Place Details.**

- Text Search (`places:searchText` in Places API New, or legacy `/maps/api/place/textsearch/json`)
  with queries like `"PG accommodation in {city}"` and `"coworking space in {city}"`. Returns up to
  20 results per page, up to 3 pages (60 results) via `next_page_token` — each subsequent page
  requires a short delay before the token becomes valid.
- Place Details, one call per unique `place_id` from the search results, requesting only the
  fields we need (field masking matters — Places API New bills by which fields you request):
  `displayName`, `formattedAddress`, `nationalPhoneNumber`/`internationalPhoneNumber`,
  `websiteUri`, `rating`, `userRatingCount`, `businessStatus`, `types`, `editorialSummary` (or
  `generativeSummary` where available), `photos` (array of photo names/references),
  `googleMapsUri`.

### Auth

`GOOGLE_MAPS_SERVER_KEY` already exists in `.env` (used today for server-side reverse geocoding —
see `docs/plans/google-maps-location-picker.md`). It's IP-restricted in Google Cloud Console, which
works fine for a script run from a known dev machine. **Action needed:** confirm the "Places API"
(and "Places API (New)" if using the new endpoints) is enabled for that key's GCP project — it may
only have Geocoding API enabled today. Reuse the same key; don't mint a new one unless the IP
restriction blocks the machine running this script.

## Data we can and can't get

Places API is a business directory, not a lead database — some of what's asked for doesn't exist
as structured data:

| Requested field | Available? | Source |
|---|---|---|
| Business name | Yes | `displayName` |
| Website | Yes, when the business listed one | `websiteUri` |
| Phone number | Yes, when Google has one | `nationalPhoneNumber` |
| Photos | Yes | `photos[].name` → Place Photo endpoint |
| Address / city / maps link | Yes | `formattedAddress`, `googleMapsUri` |
| Star rating | Yes | `rating` (0–5 average) + `userRatingCount` (number of reviews it's based on) |
| **Contact person name** | **No such field** | Left blank — per your answer, no website-scraping fallback |
| **Description** | Partial | `editorialSummary`/`generativeSummary` — Google only generates these for a subset of places (more common for well-reviewed / chain businesses); expect it blank for many small PGs |
| **Facilities/amenities** | Partial | No structured amenity list. Best-effort proxy: `types` (Google's own category tags, e.g. `lodging`, `real_estate_agency`) plus a raw dump of the first few review snippets if `reviews` field is requested — genuinely useful amenity data (wifi, food, AC) isn't queryable via this API and would need a website/listing scrape, which is out of scope here |

Both partial fields ship as **best-effort, often-empty columns** — same treatment as contact name.
No scraping beyond the Places API itself.

## Non-goals

- No automatic creation of Bhavano listings from this data (would need a review step + mapping
  onto `CATEGORY_FIELD_CONFIG`'s `pg`/`coworking` fields — different task if wanted later).
- No website scraping for contact names or richer descriptions.
- No permanent local re-hosting of Google's photos as a public image CDN — see ToS note below.

## ToS / cost notes (flagging, not blocking)

- Places API ToS restricts caching most fields beyond 30 days without a refresh call, and
  restricts using photos outside of displaying them via Google's attribution requirements — fine
  for an internal call-list CSV your ops team uses within days/weeks, but don't build a permanent
  public photo gallery from `photo_reference`s without re-reading current ToS.
- Each Text Search + each Place Details + each Photo fetch is billed separately. A run across,
  say, 10 cities × 2 categories × ~40 results/city-category × 1 Details call each is ~800 Details
  calls, plus photo calls if downloaded. Script will log a running request count so cost is
  visible; recommend a `--max-results-per-city` cap and a `--no-photos` flag for a cheap dry run.

## Querying per area, not just per city

A single `"PG accommodation in Bengaluru"` search is capped by Google at 60 results total and
returns a geographically-skewed slice — nowhere near a big city's real count spread across
localities. For each city, the script looks up its curated `Area` list via Bhavano's own
`GET /locations/areas` (the same one behind the SEO locality pages, seeded in
`apps/bff/prisma/seedCities.ts`) and runs one query per area — `"PG accommodation in
Koramangala, Bengaluru"`, etc. — instead of one for the whole city. That seed list is already
described in its own comment as "good coverage of major areas, not exhaustive", which is the
"important areas" bar used here — there's no separate importance score on `Area` to rank by, so
the full curated list is used by default (`--max-areas-per-city` caps it if needed). `cityId`/
`areaId` are set on the imported `OutreachContact` rows from this same lookup — previously left
blank. Falls back to a single city-level query if the city isn't in Bhavano's DB yet or
`--no-areas` is passed.

## Avoiding re-fetching the same location

A `--state-file` (default `./leads_output/fetched_state.json`) records every `(city, area,
category)` triple already pulled from the Places API, with a timestamp and the place count
found. On a later run, any triple already in the state file is skipped entirely — no Text Search
call, no cost — unless `--force` is passed. This is about not re-hitting the *Places API* for a
location already covered, independent of `OutreachContact`'s own upsert-on-`googlePlaceId`
(which would dedupe the *database* row even without this, but only after already paying for the
API calls).

## "Contact for price" for pg/coworking listings

Scraped businesses rarely have a single real price (plans/sharing types vary), so `price: 0` is
now a legitimate posting for `pg`/`coworking` only — enforced server-side in
`ListingsService.assertValidPrice`, not just relaxed at the DTO level, so no other category can
post a 0-priced listing. Card/detail pages render `"Contact for price"` instead of `₹0` and
suppress the qualifier chip; the detail page adds a line pointing the buyer at the existing
Message/View Contact actions. JSON-LD omits the `Offer` entirely for these listings rather than
emitting a misleading `price: "0"` to crawlers. `bulk_upload_listings.py`'s row validation
mirrors this same rule.

## Claiming a bulk-imported listing (WhatsApp verification)

A scraped business owner has never logged in, so "send a WhatsApp asking them to verify/update
their listing" needs a way to hand over a specific listing without a pre-existing account:

- `Listing.claimContactId` (→ `OutreachContact`) + `Listing.claimedAt` — set by
  `bulk_upload_listings.py` at creation (via `CreateListingDto.claimContactId`, sourced from the
  CSV's `contactId` column, which `export_outreach_contacts_for_listings.py` now includes).
- `POST /listings/:id/claim` (`ListingsService.claimListing`) — requires login, but *not*
  ownership like every other listing mutation (the point is transferring away from the "Bulk
  Import" account). Succeeds only if the caller's own verified phone (normalized via
  `toE164India`) matches `claimContact.phoneE164` exactly; one-shot (`claimedAt` already set →
  rejected, no re-claiming). On success also sets `OutreachContact.userId` — that field already
  existed for "prospect becomes a real user" but nothing set it before this.
- `/claim/[id]` (web, `noindex`) — not logged in → the *existing* OTP modal (`requireLogin`,
  `AuthGateProvider`), which already auto-creates a `User` on first verify, no new signup path
  needed; retries the claim in place via `onSuccess` rather than reloading. Success → straight
  into `/my-listings/[id]/edit`.
- **The WhatsApp send is now implemented, via MSG91** (not the direct-Meta `WhatsappProvider` —
  the user's template was approved through MSG91's own dashboard). `Msg91Provider
  .sendListingVerificationRequest` mirrors the exact request shape of `sendAdPostedConfirmation`
  (the only other confirmed-working MSG91 WhatsApp template send in this codebase — trusted over
  `OutreachSenderService`'s own WhatsApp path, which sends free-text and has never been confirmed
  to actually work). **The one unverified part**: the `components` key names/`parameter_name`
  values are a best guess by analogy, not copied from this specific template's own MSG91
  dashboard "Code" snippet (unavailable while writing this) — this file's own history already
  shows two prior guesses failing before landing on the working shape those templates use now —
  which is exactly why this one waited for the real dashboard snippet rather than shipping a
  third guess. Approved template: **`claim_listing_pg`**, 5 body variables (business name, area,
  city, phone, full claim link — plain text, separate from `button_1`'s value, which is only the
  URL *suffix* appended to a base URL baked into the template) via positional `body_1`..`body_5`
  keys with **no** `parameter_name` field — a genuinely different shape from
  `sendAdPostedConfirmation`'s `body_name`/`parameter_name`-keyed one, confirming the shape truly
  isn't guessable by analogy. `namespace` is sent as `null` (this template doesn't use one).
  - `OutreachService.sendClaimVerification` — gates on `MSG91_MARKETING_ENABLED=true`, a manual
    suppression/`consentState` check (mirroring `resolveEligible`'s logic, since this bypasses the
    `OutreachCampaign`/`CampaignSend` audience-resolution machinery entirely — a deliberate,
    one-contact, script-triggered send, not an automated recurring blast), and now also requires
    the contact to have a city/area on file (both feed the template). Builds the claim link from
    `PUBLIC_SITE_URL` (same fallback `NotificationsService` uses) + `/claim/<listingId>`. On
    success updates `OutreachContact.lastContactedAt`/`contactedCount`.
  - Env vars (scaffolded in `.env.production.example`, unset locally):
    `MSG91_WHATSAPP_CLAIM_TEMPLATE_NAME=claim_listing_pg`, `MSG91_WHATSAPP_CLAIM_NAMESPACE` left
    unset (reuses the existing `MSG91_WHATSAPP_INTEGRATED_NUMBER`).
  - `bulk_upload_listings.py --send-whatsapp` — after each successful listing creation, calls
    `POST /admin/outreach/contacts/:id/send-claim-whatsapp` for rows that had a `contactId`.
  - Verified end-to-end against the local BFF with throwaway rows: the marketing-disabled gate,
    no-claimable-listing, already-claimed, opted-out, and missing-city/area rejection paths all
    return the right `reason` without ever reaching MSG91. The exact outbound request body was
    also verified byte-for-byte against the real dashboard snippet, with `fetch` stubbed to
    capture rather than send — no real network call was made, so the live MSG91 send itself is
    still unconfirmed until a real `MSG91_AUTH_KEY` is configured and a real send is tried.

Verified end-to-end against the local BFF with throwaway test rows: wrong-phone claim → 403,
matching-phone claim → 201 + ownership transferred + `OutreachContact.userId` set, re-claim →
400. Test data cleaned up afterward.

## Decided defaults

- Photo downloading is **on by default**, capped at **6 photos per place** (`--max-photos 6`,
  overridable; `--no-photos` opts out entirely).
- No built-in default city list — `--cities`/`--cities-file` is required every run.
- Uses the **legacy Places API** (`/maps/api/place/{textsearch,details,photo}/json`), not
  "Places API (New)" — simple API-key query params match the rest of this repo's root scripts
  (no field-mask headers/POST bodies needed). **Enable "Places API" (not just Geocoding API) on
  the GCP project behind `GOOGLE_MAPS_SERVER_KEY`** before running — the script fails fast with a
  clear message pointing at this if it isn't.

## Script design

`get_pg_coworking_leads.py` (repo root, alongside the other one-off scripts):

```
python get_pg_coworking_leads.py --cities "Bengaluru,Pune,Hyderabad" \
    --categories pg,coworking \
    --max-results 40 \
    --download-photos \
    --out-dir ./leads_output
```

- **Input:** `--cities` (comma-separated, or `--cities-file path.txt`, one per line);
  `--categories` (`pg`, `coworking`, or both — default both).
- **Flow per (city, category):**
  1. Build query string (`"PG accommodation in {city}"` / `"coworking space in {city}"`).
  2. Text Search, paginate up to 3 pages, respecting the ~2s delay Google requires before
     `next_page_token` is valid.
  3. Dedupe by `place_id` (Text Search can return overlapping results across paginated calls).
  4. Place Details per unique `place_id`, field-masked to only what's listed above.
  5. If `--download-photos`: fetch up to N (default 3) photos per place via the Place Photo
     endpoint, save to `<out-dir>/photos/<place_id>_<n>.jpg`; otherwise just record the photo
     reference/name in the CSV for later on-demand fetch.
  6. Rate-limit requests (simple sleep/backoff) and retry on `OVER_QUERY_LIMIT`/`UNAVAILABLE`.
- **Output:** one CSV per run at `<out-dir>/leads_<timestamp>.csv` with columns:
  `city, category, place_id, name, contact_name (blank), phone, website, description, facilities_types, address, rating, rating_count, google_maps_url, photo_paths_or_refs`.
- **Config:** reads `GOOGLE_MAPS_SERVER_KEY` from `.env` via `python-dotenv` (same pattern as the
  other root scripts); fails fast with a clear message if the key or Places API isn't enabled.
- **Dependencies:** `requests`, `python-dotenv` — check `requirements.txt` / existing script
  imports at implementation time to match whatever's already installed rather than introducing a
  new HTTP client.

## Open items to confirm before implementation

1. Confirm Places API is enabled on the GCP project behind `GOOGLE_MAPS_SERVER_KEY` (I can't check
   Google Cloud Console myself — you'll need to verify or share access).
2. Default city list, if any (or always required via `--cities`)?
3. `--download-photos` default on or off (affects cost/runtime per run)?
