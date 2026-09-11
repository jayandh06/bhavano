# Scraper API cost analysis — what's called, how often, and how to cut it

Working notes from a cost-planning conversation about `get_pg_coworking_leads.py`. Captures the
full API surface it touches, how call counts actually scale (some of it is non-obvious), worked
examples for a few real scraping plans, and concrete levers to reduce spend. Not a design decision
that needs building — a reference for planning a run's scope and budget.

**Pricing caveat, same discipline as [deployment.md's own "Regional pricing caveat"](../deployment.md#regional-pricing-caveat):**
any dollar/rupee figures below are illustrative, from general knowledge of Google's legacy Places
API SKU structure, not verified current rates. Check Google Cloud Console's actual current pricing
before budgeting real spend against any number here — Google has been steering users toward
"Places API (New)," which uses an entirely different SKU/pricing structure, so legacy pricing may
also have shifted.

## The full pipeline — every API involved, in call order

| # | API | Called by | Granularity |
|---|---|---|---|
| 1 | Bhavano `GET /locations/cities` | `lookup_city()` | once per city |
| 2 | Bhavano `GET /locations/areas` | `lookup_areas()` | once per city (skipped entirely with `--no-areas`) |
| 3 | Bhavano `GET /admin/.../fetched-pairs` | `fetch_fetched_pairs()` | once per city |
| 4 | **Google Places Text Search** | `text_search()` | once per query *page* — see below, not just once per query |
| 5 | Bhavano `POST /admin/.../places-fetch-log` | `create_places_fetch_log()` | once per (area, category, queryPrefix) query, before searching |
| 6 | Bhavano `PATCH /admin/.../places-fetch-log/:id` | `update_places_fetch_log_counts()` | once per query, after |
| 7 | **Google Places Details** | `place_details()` | once per unique place kept |
| 8 | **Google Places Photo** | `download_photos()` | once per photo, up to `--max-photos` (default 6) per place |
| 9 | **Google Geocoding** (via Bhavano's own `/locations/reverse-geocode` proxy) | `reverse_geocode()` | once per unique place, unless `--no-reverse-geocode` |
| 10 | Bhavano `POST /admin/outreach/contacts/import` | `import_contacts()` | **once for the entire run** — every city's contacts batched into one call |

`mint_admin_jwt()` is local HMAC signing, not a network call — excluded above. Bhavano's own
endpoints (1, 2, 3, 5, 6, 10) aren't billed the way the Google ones are; they're internal
BFF/network overhead, not quota spend.

## Text Search: call count isn't proportional to `--max-results` the way you'd expect

Google returns up to ~20 results per page. The loop only fetches another page if it still needs
more:

```python
if not next_page_token or len(results) >= max_results:
    break
```

**Any `--max-results` at or under ~20 resolves in exactly 1 request** — asking for 5 costs the
same as asking for 20, since both are satisfied (or the area's results are exhausted) within the
first page. Only crossing that ~20 threshold costs extra requests: `--max-results 50` needs up to
3 pages/requests (page1 ~20 → page2 ~40 → page3 ~50-60) to actually reach 50.

**Practical takeaway: stay at or under `--max-results 20` per query whenever possible.** You get up
to 20 results for the same 1-request cost as asking for fewer, and only pay extra once you cross
that ceiling.

## Worked examples — 10 cities either way

### Option 1 — city-level, `--max-results 50` per city (`--no-areas`)

| API | Count | Why |
|---|---|---|
| `/locations/cities` | 10 | 1/city |
| `/locations/areas` | 0 | `--no-areas` skips it |
| `/fetched-pairs` | 10 | 1/city |
| Text Search | ~30 | 3 pages/city to reach 50 |
| `places-fetch-log` POST/PATCH | 10 each | 1 per city-level query |
| Place Details | ~500 | 1 per unique place (50 × 10) |
| Place Photo | up to 3000 | ≤6 per place × 500 |
| Geocoding | ~500 | 1 per unique place |
| `contacts/import` | 1 | whole run |

**Real-world caveat**: Google hard-caps Text Search at 60 results *per query* and, per this
script's own module docstring, a city-level search "returns a geographically-skewed slice —
nowhere near covering a big city's actual PG count spread across localities." Asking for 50
city-wide doesn't reliably *deliver* 50 good, geographically-distinct results — that's the actual
reason area-based querying exists in this script at all, not just quota efficiency.

### Option 2 — 10 areas/city, `--max-results 5` (500 total target)

| API | Count | Why |
|---|---|---|
| `/locations/cities` | 10 | |
| `/locations/areas` | 10 | 1/city, needed for the area list |
| `/fetched-pairs` | 10 | |
| Text Search | **100** | 1 request/area (5 ≤ page size) |
| `places-fetch-log` POST/PATCH | 100 each | 1 per area query |
| Place Details | ~500 | 5 × 100 — same total as Option 1 |
| Place Photo | up to 3000 | same |
| Geocoding | ~500 | same |
| `contacts/import` | 1 | |

More Text Search requests than Option 1 (100 vs ~30) for the *same* total place count, purely
because each small ask still costs its own request. But far better geographic coverage.

### Option 3 — 10 areas/city, `--max-results 20` (2000 total target — the actual planned run)

| API | Count | Why |
|---|---|---|
| `/locations/cities` | 10 | |
| `/locations/areas` | 10 | |
| `/fetched-pairs` | 10 | |
| Text Search | **100** | still 1 request/area — 20 is exactly at the page-size ceiling, same cost as Option 2's 5 |
| `places-fetch-log` POST/PATCH | 100 each | |
| Place Details | **~2000** | 20 × 100 |
| Place Photo | **up to 12,000** | ≤6 × 2000 |
| Geocoding | **~2000** | |
| `contacts/import` | 1 | |

Key finding: going from 5→20 per area costs the **same** in Text Search requests (100 either way,
since both are ≤20/page) — the 4x growth in Details/Photo/Geocoding is purely because the *target
place count* grew 4x, not because of how the query was shaped.

## Place Details — do we actually need it?

**Yes, but only for two fields.** Checked every field `build_contact()` reads off the Details
response against what Text Search's own result already contains:

| Field used | Already in Text Search's result? |
|---|---|
| `formatted_phone_number` | **No — Details-only. The essential one.** |
| `website` | **No — Details-only. Essential.** |
| `editorial_summary` | No — Details-only, but only feeds an optional notes line |
| `geometry` / location | Yes |
| `business_status` | Yes |
| `types` | Yes |
| `name` | Yes (it's what was searched) |
| `formatted_address` | Yes |
| `rating` / `user_ratings_total` | Yes |
| `place_id` | Yes (it's the input to this very call) |
| `photos` (photo references) | Yes |

Phone number and website sit behind Google's "Contact Data" field category, exclusive to Details
— Text Search fundamentally can't provide them. Since `OutreachContact` requires a phone or email
just to import a row at all, Details can't be dropped without defeating the scraper's purpose.

**But 8 of 11 requested fields are redundant** — already sitting in the Text Search result that
led to calling Details in the first place. Trimming them:
- Doesn't clearly reduce *billed cost* beyond what dropping `rating`/`user_ratings_total` already
  achieves (Basic Data is likely billed as a floor regardless of which basic fields are listed —
  worth confirming against current Google SKU docs before assuming further savings here).
- **Does** improve robustness: today, `if not details: continue` drops the place entirely on any
  Details failure, even though name/location/rating/photos were already known from Text Search.
  Sourcing those fields from Text Search instead would mean a Details hiccup only costs the
  phone/website for that one place, not the whole lead.

## Cost-reduction levers, in priority order

1. **Lower `--max-photos`.** Zero code change, straight multiplier — Photo cost scales linearly
   with this. 6→3 halves Photo API spend immediately.
2. **Drop `rating`/`user_ratings_total` from `DETAILS_FIELDS`, reuse the values Text Search
   already returned.** Small, safe code change — likely removes Details calls from Google's
   "Atmosphere Data" pricing tier, for data already paid for once. Not yet implemented.
3. **Filter earlier and harder** (`--min-rating`, or a new `--min-reviews`). Filtering already
   happens *before* Details/Photo/Geocoding in `collect_city()` — a stricter threshold means fewer
   places ever reach those per-place calls at all. Savings scale with how much gets filtered out,
   which is data-dependent (varies by city/area/threshold), not a fixed multiplier.
4. **(Bigger, structural) Defer photo downloads until a listing is actually created.** Not every
   scraped contact becomes a listing (`createListingFromContact` is a separate, later, manual
   admin decision) — every photo downloaded during scraping for a contact that never converts is
   wasted spend. Storing `photo_reference` tokens (already in the Details/Text Search response, no
   extra cost to capture) instead of downloading images immediately, and only calling the Photo
   API at listing-creation time, would eliminate that waste entirely. Real architecture change: the
   BFF would need its own Google Photos access at that point, and `photo_reference` tokens should
   be checked for how long they stay valid before relying on this. Not yet planned in detail.

Already in place, not new: `PlacesFetchLog`'s fetched-pairs skip check avoids re-paying for an
already-scraped `(area, category, queryPrefix)` combo unless `--force` is passed — see
[pg-coworking-places-fetch-log.md](./pg-coworking-places-fetch-log.md).

## Illustrative before/after — Option 3's 2000-place run

Applying levers #1 (`--max-photos` 6→3) and #2 (drop redundant Details fields) together. **Again:
illustrative rates, verify current pricing before treating this as a real budget.**

| | Text Search | Details | Photo | Geocoding | Total (USD) | Total (INR, ~₹88/$) |
|---|---|---|---|---|---|---|
| Before | 100 × $0.032 = $3.20 | 2000 × $0.025 = $50.00 | up to 12,000 × $0.007 = $84.00 | 2000 × $0.005 = $10.00 | **~$147** | **~₹12,950** |
| After | $3.20 (unchanged) | 2000 × $0.020 = $40.00 | up to 6,000 × $0.007 = $42.00 | $10.00 (unchanged) | **~$95** | **~₹8,380** |
| Savings | — | $10.00 | up to $42.00 | — | **~$52 (~35%)** | **~₹4,570** |

The Photo figures assume every place has the full 6 (or 3) photos available, which is a ceiling —
real averages are typically lower, so actual Photo spend is likely less than shown either way.
Google Maps Platform also typically carries some monthly free credit that could offset part of
this; not factored in since its current terms weren't verified.
