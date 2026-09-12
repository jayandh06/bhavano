"""Pull PG and coworking-space businesses via an Apify Google Maps Scraper Actor instead of
Google's own paid Places API — a separate script from get_pg_coworking_leads.py, not a
modification of it, so the original (already validated) Google-API-based path stays exactly as
it was. See docs/plans/pg-coworking-scraping-api-costs.md for the Google-side cost/field
reasoning this was compared against.

Reuses every Bhavano-side piece from get_pg_coworking_leads.py unchanged — city/area resolution,
reverse-geocoding, PlacesFetchLog bookkeeping, contact import, the --query-prefix mechanism —
imported, not duplicated. Only the actual place-search mechanism differs: one Apify Actor run per
(area, category, query-prefix) pair replaces Google's Text Search + Place Details + Place Photo
calls combined, since the Actor's single result already carries phone/website/rating/photo(s) —
no separate "Details" step needed the way Google's API requires.

IMPORTANT — read before running this for real, not just get_pg_coworking_leads.py's usual caveats:
  - This scrapes Google Maps' own web interface via third-party automation (an Apify Actor), not
    Google's sanctioned paid Places API. That's a materially different ToS/legal posture than the
    Google-API-based script — a deliberate decision to weigh consciously, not a default to reach
    for just because it's cheaper. See the cost-comparison plan doc for the fuller discussion.
  - Field names below (title/address/phone/website/location/totalScore/reviewsCount/categories/
    imageUrl/permanentlyClosed/temporarilyClosed) were confirmed against a real, live run's
    output (5 "Gents PG" results in Whitefield, Bengaluru), not just the Actor's documented
    input/output schema pages — those turned out to describe a different shape than what a real
    run actually returns (the docs said `imageUrls`, a plural array; the real output has a
    single `imageUrl`). Apify Actors are third-party-maintained and can change their output
    without notice — spot-check a --dry-run before trusting a real run at volume, and don't
    assume the documented schema matches the live one without checking.
  - `businessStatus` is derived from the Actor's own `permanentlyClosed`/`temporarilyClosed`
    booleans (both confirmed present in real output) — CLOSED_PERMANENTLY / CLOSED_TEMPORARILY /
    OPERATIONAL, matching Google's own enum values so the existing businessStatus quality gate
    in createListingFromContact works the same regardless of which script sourced the contact.
  - Photos: --max-photos 1 (default) gets one free `imageUrl` per place, bundled with the base
    place scrape. --max-photos above 1 sets the Actor's own `maxImages` input (confirmed live to
    return a plural `imageUrls` array), which its live pricing schema says triggers a separate
    "additional place details scraped" charge per place — a deliberate cost tradeoff the caller
    opts into by raising --max-photos, not a default. See apify_search()'s and
    download_apify_photos()'s own docstrings. Downloaded into the
    exact same <photos-dir>/photos/{googlePlaceId}_{i}.jpg layout get_pg_coworking_leads.py
    already uses, so bulk_upload_listings.py and the admin's "Create listing" action work
    unchanged regardless of which script produced them.

Run: python get_pg_coworking_leads_apify.py --cities "Bengaluru,Pune" --apify-token <token>
(or set APIFY_API_TOKEN in .env instead of passing --apify-token every time)
"""

import argparse
import os
import sys
import time
from datetime import datetime

import requests
from dotenv import load_dotenv

from get_pg_coworking_leads import (
    QUERY_NOUNS,
    build_query,
    create_places_fetch_log,
    fetch_fetched_pairs,
    import_contacts,
    mint_admin_jwt,
    parse_cities,
    resolve_locations,
    reverse_geocode,
    update_places_fetch_log_counts,
)

load_dotenv("apps/bff/.env")
load_dotenv(".env")

# username~actor-name form, per Apify's API — the most established Google Maps Scraper Actor.
# A different Actor can be swapped in via --actor-id, but its output field names may not match
# build_contact() below — verify with --dry-run before trusting a swap.
DEFAULT_ACTOR_ID = "compass~crawler-google-places"
APIFY_API_BASE = "https://api.apify.com/v2"
# Apify's own run-sync endpoint caps out at 300s by default; override via --actor-timeout for a
# --max-results large enough that the Actor genuinely needs longer than that to finish.
DEFAULT_ACTOR_TIMEOUT_SECONDS = 300
MAX_PHOTOS_DEFAULT = 1
REQUEST_DELAY_SECONDS = 0.2
# apps/bff/src/main.ts sets no explicit JSON body-size limit, so it's Express's default 100kb —
# easily exceeded by one city's full contact list in a single POST (confirmed in production: a
# 413 on a city with enough contacts killed the entire run, no per-city isolation). Chunking
# keeps each import_contacts() call comfortably under that regardless of how many contacts one
# city produces.
IMPORT_BATCH_SIZE = 20


class RequestCounter:
    def __init__(self):
        self.actor_runs = 0
        self.photos = 0

    def summary(self):
        return f"Apify requests — actor runs: {self.actor_runs}, photo downloads: {self.photos}"


class Tee:
    """Every print() in this script already writes to sys.stderr — wrapping sys.stderr itself
    with this, once, at startup means the whole run's output lands in both the terminal and a
    persistent log file with no changes to any individual print call. Line-buffered (flushed on
    every write) so `tail -f` on the log file shows progress live, not just after the run ends or
    exits abnormally."""

    def __init__(self, *streams):
        self.streams = streams

    def write(self, data):
        for s in self.streams:
            s.write(data)
            s.flush()

    def flush(self):
        for s in self.streams:
            s.flush()


def apify_search(apify_token, actor_id, query, location_text, max_results, timeout_sec, counter, max_images=1):
    """POST .../actors/:actorId/run-sync-get-dataset-items — runs the Actor and returns its
    result dataset directly in this one HTTP response (Apify handles the run-then-wait
    internally), rather than the separate search+details Google's own API needs. Returns []
    on any failure — a network error, a timeout, or the Actor erroring — so one bad pair never
    aborts an otherwise-working multi-city run.

    max_images > 1 sets the Actor's own `maxImages` input, confirmed live to populate a plural
    `imageUrls` array (vs. just the free singular `imageUrl` when omitted) — but per the Actor's
    own live pricing schema, this triggers a separate "additional place details scraped" charge
    per place, so it's only sent when the caller explicitly asks for more than the 1 free image
    (max_images == 1 omits the parameter entirely, preserving the free-only default)."""
    body = {
        "searchStringsArray": [query],
        "locationQuery": location_text,
        "maxCrawledPlacesPerSearch": max_results,
    }
    if max_images > 1:
        body["maxImages"] = max_images
    try:
        resp = requests.post(
            f"{APIFY_API_BASE}/actors/{actor_id}/run-sync-get-dataset-items",
            params={"timeout": timeout_sec},
            headers={"Authorization": f"Bearer {apify_token}"},
            json=body,
            # HTTP client timeout comfortably above Apify's own run timeout, so we see Apify's
            # own 408 response rather than our own connection just dying first.
            timeout=timeout_sec + 30,
        )
        counter.actor_runs += 1
        if resp.status_code == 408:
            print(
                f"  warning: Apify run timed out after {timeout_sec}s for '{query}' in "
                f"'{location_text}' — try a smaller --max-results or a larger --actor-timeout",
                file=sys.stderr,
            )
            return []
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException as e:
        print(f"  warning: Apify run failed for '{query}' in '{location_text}': {e}", file=sys.stderr)
        return []


def download_apify_photos(image_urls, place_id, out_dir, max_photos, counter):
    """Apify's image URLs are already direct, downloadable links — no photo_reference / separate
    Photo API call needed the way Google requires. Same output layout as
    get_pg_coworking_leads.py's own download_photos(): <out_dir>/photos/{place_id}_{i}.jpg.

    --max-photos 1 (the default) gets exactly one free `imageUrl` per place, bundled with the
    base place scrape. --max-photos above 1 sets the Actor's `maxImages` input (see
    apify_search()), which per its own live pricing schema triggers a separate "additional place
    details scraped" charge per place — a real cost tradeoff the caller opts into explicitly by
    raising --max-photos, not a default."""
    photo_dir = os.path.join(out_dir, "photos")
    os.makedirs(photo_dir, exist_ok=True)
    saved_paths = []
    for i, url in enumerate((image_urls or [])[:max_photos]):
        try:
            resp = requests.get(url, timeout=20)
            counter.photos += 1
        except requests.RequestException:
            continue
        if resp.status_code != 200:
            continue
        path = os.path.join(photo_dir, f"{place_id}_{i}.jpg")
        with open(path, "wb") as f:
            f.write(resp.content)
        saved_paths.append(path)
        time.sleep(REQUEST_DELAY_SECONDS)
    return saved_paths


def build_contact(city, area, category, query, place, photo_paths, city_id, area_id, bff_url=None, use_geocode=True, places_fetch_log_id=None):
    """Apify-field-reading twin of get_pg_coworking_leads.py's own build_contact() — same
    OutreachContactInputDto shape out, same reverse-geocode precision logic, just reading the
    Actor's field names (title/address/phone/website/location/totalScore/reviewsCount/
    categories/permanentlyClosed/temporarilyClosed) instead of Google's (name/formatted_address/
    formatted_phone_number/website/geometry/rating/user_ratings_total/types/business_status). No
    separate "details" param needed — Apify's one result already has everything Google's Text
    Search + Details combined would. Field names confirmed against a real run's output, not just
    the Actor's documented input/output schema pages — see this module's own docstring."""
    location = place.get("location") or {}
    lat, lng = location.get("lat"), location.get("lng")

    resolved_city_id, resolved_area_id, geocode_note = city_id, area_id, None
    if use_geocode and bff_url and lat is not None and lng is not None:
        geo = reverse_geocode(bff_url, lat, lng)
        if geo:
            if city_id is None or geo.get("cityId") == city_id:
                resolved_city_id = geo.get("cityId") or city_id
                resolved_area_id = geo["areaId"]
            else:
                geocode_note = (
                    f"Reverse-geocode placed this in '{geo.get('cityName')}' near "
                    f"{geo.get('formattedAddress')}, not the searched city '{city}' — kept the "
                    "search-area assignment; verify manually."
                )

    notes_parts = [
        f"City searched: {city}" + (f" ({area})" if area else ""),
        "Source: Apify (compass/crawler-google-places), not Google's own Places API.",
    ]
    if geocode_note:
        notes_parts.append(geocode_note)
    categories = place.get("categories") or []
    if categories:
        notes_parts.append(f"Categories: {', '.join(categories)}")
    if photo_paths:
        notes_parts.append(f"Local photos: {'; '.join(photo_paths)}")

    return {
        "name": (place.get("title") or "").strip() or "(no name)",
        "phone": place.get("phone") or None,
        "address": place.get("address") or None,
        "lat": lat,
        "lng": lng,
        "cityId": resolved_city_id,
        "areaId": resolved_area_id,
        "googleRating": place.get("totalScore"),
        "googleReviewCount": place.get("reviewsCount"),
        "googlePlaceId": place.get("placeId") or None,
        "businessCategory": category,
        "businessStatus": (
            "CLOSED_PERMANENTLY" if place.get("permanentlyClosed")
            else "CLOSED_TEMPORARILY" if place.get("temporarilyClosed")
            else "OPERATIONAL"
        ),
        "placesFetchLogId": places_fetch_log_id,
        "website": place.get("website") or None,
        "sourceRef": query,
        "notes": "\n".join(notes_parts),
    }


def collect_city(apify_token, actor_id, city, city_id, locations, categories, max_results, out_dir, download, max_photos, counter, fetched_pairs, force, min_rating=None, bff_url=None, use_geocode=True, bff_token=None, dry_run=False, query_prefix=None, actor_timeout=DEFAULT_ACTOR_TIMEOUT_SECONDS):
    """Simpler than get_pg_coworking_leads.py's own collect_city(): since one Apify call already
    returns full contact details per place, there's no separate search-then-details two-phase
    loop — dedupe (by placeId, across every area/category this city covers, same reasoning as
    the Google version — the same PG can plausibly surface from more than one neighbouring
    area's query), the --min-rating filter, and build_contact() all happen in a single pass over
    each pair's results.

    query_prefix / fetched_pairs / force work exactly as in get_pg_coworking_leads.py's own
    collect_city() — same (areaId, category, queryPrefix) skip-check key, same PlacesFetchLog
    create-before-search-then-patch-after flow, so a mixed history of Google-sourced and
    Apify-sourced fetches for the same city coexists correctly (they're keyed by search term and
    area, not by which script or provider ran it)."""
    seen = {}
    pair_stats = {}
    for loc in locations:
        for category in categories:
            noun = query_prefix or QUERY_NOUNS[category]
            if (loc["areaId"], category, noun) in fetched_pairs and not force:
                continue
            query = build_query(noun, city, loc["area"])
            location_text = f"{loc['area']}, {city}, India" if loc["area"] else f"{city}, India"
            print(f"  searching (Apify): {query}", file=sys.stderr)
            log_id = None
            if not dry_run:
                log_id = create_places_fetch_log(bff_url, bff_token, {
                    "citySearched": city,
                    "cityId": city_id,
                    "areaSearched": loc["area"],
                    "areaId": loc["areaId"],
                    "businessCategory": category,
                    "queryPrefix": noun,
                    "query": query,
                    "minRatingFilter": min_rating,
                })
            places = apify_search(apify_token, actor_id, noun, location_text, max_results, actor_timeout, counter, max_images=max_photos)
            pair_stats[(loc["area"], category)] = {
                "areaId": loc["areaId"], "logId": log_id, "query": query,
                "found": len(places), "imported": 0,
            }
            for place in places:
                place_id = place.get("placeId")
                if not place_id or place_id in seen:
                    continue
                if min_rating is not None and (place.get("totalScore") or 0) < min_rating:
                    continue
                seen[place_id] = (category, query, loc, log_id, place)

    contacts = []
    for place_id, (category, query, loc, log_id, place) in seen.items():
        photo_paths = []
        if download:
            # imageUrls (plural) only appears when maxImages was set on the request (max_photos
            # > 1) — confirmed live; otherwise only the free singular imageUrl is present.
            image_urls = place.get("imageUrls") or ([place["imageUrl"]] if place.get("imageUrl") else [])
            photo_paths = download_apify_photos(image_urls, place_id, out_dir, max_photos, counter)

        contacts.append(
            build_contact(
                city, loc["area"], category, query, place, photo_paths, city_id, loc["areaId"],
                bff_url=bff_url, use_geocode=use_geocode, places_fetch_log_id=log_id,
            )
        )
        pair_stats[(loc["area"], category)]["imported"] += 1
    return contacts, pair_stats


def import_contacts_batched(bff_url, token, contacts, batch_size=IMPORT_BATCH_SIZE):
    """Chunks contacts into batches before calling get_pg_coworking_leads.py's own
    import_contacts() — see IMPORT_BATCH_SIZE's own comment for why. Best-effort per batch: a
    failed batch is logged and skipped rather than raising, so one bad batch (network hiccup,
    unexpected 413/500) doesn't lose every other already-successful city in the same run —
    import_contacts()'s own SystemExit (on 401/403, a bad JWT) still propagates immediately,
    since that won't fix itself on the next batch either."""
    totals = {"created": 0, "updated": 0, "skipped": 0, "failed_batches": 0}
    for i in range(0, len(contacts), batch_size):
        batch = contacts[i : i + batch_size]
        try:
            result = import_contacts(bff_url, token, batch)
            totals["created"] += result.get("created", 0)
            totals["updated"] += result.get("updated", 0)
            totals["skipped"] += result.get("skipped", 0)
        except SystemExit:
            raise
        except requests.RequestException as e:
            totals["failed_batches"] += 1
            print(f"  warning: import batch ({len(batch)} contacts) failed: {e}", file=sys.stderr)
    return totals


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--cities", help="Comma-separated city names, e.g. 'Bengaluru,Pune'")
    parser.add_argument("--cities-file", help="Path to a file with one city name per line")
    parser.add_argument(
        "--categories",
        default="pg,coworking",
        help="Comma-separated: pg, coworking, or both (default: both)",
    )
    parser.add_argument("--max-results", type=int, default=20, help="Max places per (area, category) query (default 20)")
    parser.add_argument(
        "--min-rating",
        type=float,
        default=None,
        help="Only keep places with a rating >= this (e.g. 4.0). Applied after the Actor run, "
        "before Actor-run costs a photo download or a Bhavano import — a place with no rating "
        "at all is excluded whenever this is set, same as get_pg_coworking_leads.py.",
    )
    parser.add_argument(
        "--query-prefix",
        default=None,
        help="Override the search term instead of the category default ('PG accommodation' / "
        "'coworking space') — same flag, same semantics as get_pg_coworking_leads.py's own.",
    )
    parser.add_argument(
        "--no-reverse-geocode",
        action="store_true",
        help="Skip reverse-geocoding each place's exact lat/lng for a precise City/Area match. "
        "On by default, same reasoning as get_pg_coworking_leads.py's own flag.",
    )
    parser.add_argument("--no-areas", action="store_true", help="Query at the city level only")
    parser.add_argument("--max-areas-per-city", type=int, default=None, help="Cap how many curated areas to query per city")
    parser.add_argument("--bff-url", default="http://localhost:4000", help="BFF base URL (default http://localhost:4000)")
    parser.add_argument(
        "--apify-token",
        default=os.environ.get("APIFY_API_TOKEN"),
        help="Apify API token (defaults to APIFY_API_TOKEN from .env if not passed)",
    )
    parser.add_argument(
        "--actor-id",
        default=DEFAULT_ACTOR_ID,
        help=f"Apify Actor to run, username~actor-name form (default {DEFAULT_ACTOR_ID}). A "
        "different Actor's output field names may not match build_contact() — verify with "
        "--dry-run before trusting a swap.",
    )
    parser.add_argument(
        "--actor-timeout",
        type=int,
        default=DEFAULT_ACTOR_TIMEOUT_SECONDS,
        help=f"Seconds to let one Actor run take before giving up on that pair (default {DEFAULT_ACTOR_TIMEOUT_SECONDS})",
    )
    parser.add_argument("--photos-dir", default="./leads_output", help="Where downloaded photos are saved (default ./leads_output)")
    parser.add_argument("--no-photos", action="store_true", help="Don't download photos at all")
    parser.add_argument(
        "--max-photos",
        type=int,
        default=MAX_PHOTOS_DEFAULT,
        help=f"Max photos to fetch per place (default {MAX_PHOTOS_DEFAULT}, free). Above 1, this "
        "sets the Actor's own maxImages input, which triggers a separate paid "
        "'additional place details scraped' charge per place — a deliberate cost tradeoff, not "
        "the default.",
    )
    parser.add_argument("--dry-run", action="store_true", help="Fetch and print counts, but don't write anything to the BFF")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Refetch every requested (city, area, category) triple even if PlacesFetchLog says it's already been done",
    )
    parser.add_argument(
        "--log-file",
        default=None,
        help="Persist this run's full output here too, not just the terminal, so it can be "
        "reviewed after the run ends (or if it crashes) — default: "
        "<photos-dir>/logs/run_<timestamp>.log. Pass 'none' to disable.",
    )
    args = parser.parse_args()

    if args.log_file != "none":
        log_path = args.log_file or os.path.join(
            args.photos_dir, "logs", f"run_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
        )
        os.makedirs(os.path.dirname(log_path) or ".", exist_ok=True)
        sys.stderr = Tee(sys.stderr, open(log_path, "a", buffering=1))
        print(f"Logging this run's full output to {log_path}", file=sys.stderr)

    if not args.cities and not args.cities_file:
        parser.error("one of --cities or --cities-file is required")

    if not args.apify_token:
        raise SystemExit("Apify API token not found — pass --apify-token or set APIFY_API_TOKEN in .env")

    jwt_secret = os.environ.get("AUTH_JWT_SECRET")
    if not jwt_secret:
        raise SystemExit("AUTH_JWT_SECRET not found — check apps/bff/.env")
    bff_token = mint_admin_jwt(jwt_secret, sub="get_pg_coworking_leads_apify_script")

    categories = [c.strip() for c in args.categories.split(",") if c.strip()]
    for c in categories:
        if c not in QUERY_NOUNS:
            raise SystemExit(f"Unknown category '{c}' — must be one of {list(QUERY_NOUNS)}")

    cities = parse_cities(args)
    os.makedirs(args.photos_dir, exist_ok=True)

    counter = RequestCounter()
    all_contacts = []
    totals = {"created": 0, "updated": 0, "skipped": 0, "failed_batches": 0}
    for city in cities:
        print(f"Resolving locations for {city}...", file=sys.stderr)
        city_id, locations = resolve_locations(args.bff_url, city, args.max_areas_per_city, args.no_areas)
        area_label = "city-level only" if len(locations) == 1 and locations[0]["area"] is None else f"{len(locations)} areas"
        print(f"  {area_label}", file=sys.stderr)

        fetched_pairs = fetch_fetched_pairs(args.bff_url, bff_token, city, city_id)
        already_done = [
            (loc["area"], cat)
            for loc in locations
            for cat in categories
            if (loc["areaId"], cat, args.query_prefix or QUERY_NOUNS[cat]) in fetched_pairs
        ]
        if already_done and not args.force:
            print(
                f"  skipping {len(already_done)} already-fetched (area, category) pairs "
                "(see PlacesFetchLog; use --force to refetch)",
                file=sys.stderr,
            )

        contacts, pair_stats = collect_city(
            args.apify_token,
            args.actor_id,
            city,
            city_id,
            locations,
            categories,
            args.max_results,
            args.photos_dir,
            not args.no_photos,
            args.max_photos,
            counter,
            fetched_pairs,
            args.force,
            args.min_rating,
            args.bff_url,
            not args.no_reverse_geocode,
            bff_token,
            args.dry_run,
            args.query_prefix,
            args.actor_timeout,
        )
        all_contacts.extend(contacts)

        if not args.dry_run:
            for stats in pair_stats.values():
                update_places_fetch_log_counts(args.bff_url, bff_token, stats["logId"], stats["found"], stats["imported"])

        # Imported per city, not once at the very end — a run spanning many cities can take a
        # while (each area is its own paid Apify call), and importing only after every city
        # finishes meant a run interrupted partway (Ctrl+C, SSH drop, a crash) saved nothing at
        # all to OutreachContact, even for cities that had already completed successfully.
        if not args.dry_run and contacts:
            result = import_contacts_batched(args.bff_url, bff_token, contacts)
            totals["created"] += result["created"]
            totals["updated"] += result["updated"]
            totals["skipped"] += result["skipped"]
            totals["failed_batches"] += result["failed_batches"]
            print(
                f"  imported ({city}) — created: {result['created']}, "
                f"updated: {result['updated']}, skipped (no phone/email): {result['skipped']}"
                + (f", FAILED BATCHES: {result['failed_batches']}" if result["failed_batches"] else ""),
                file=sys.stderr,
            )

    print(f"\nFetched {len(all_contacts)} places total.", file=sys.stderr)
    print(counter.summary(), file=sys.stderr)

    if args.dry_run:
        print("\n--dry-run: not importing into OutreachContact.", file=sys.stderr)
        return

    print(
        f"\nImported into OutreachContact — created: {totals['created']}, "
        f"updated: {totals['updated']}, skipped (no phone/email): {totals['skipped']}",
        file=sys.stderr,
    )
    if totals["failed_batches"]:
        print(
            f"WARNING: {totals['failed_batches']} import batch(es) failed outright — some scraped "
            "contacts were NOT saved to OutreachContact. Their PlacesFetchLog rows are already "
            "marked fetched, so a plain rerun will skip re-searching them; rerun the affected "
            "city/cities with --force to pick them back up.",
            file=sys.stderr,
        )
    print("consentState defaults to 'none' — review in /outreach/contacts before campaigning.", file=sys.stderr)


if __name__ == "__main__":
    main()
