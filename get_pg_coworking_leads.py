"""Pull PG and coworking-space businesses from the Google Places API and import them straight
into the existing OutreachContact table (apps/bff/prisma/schema.prisma) via the admin BFF's
POST /admin/outreach/contacts/import — for the sales/ops team to see and campaign against from
the admin panel's /outreach/contacts page, not a separate CSV. See
docs/plans/pg-coworking-google-places-leadgen.md for the full design and its caveats:

  - Queries per (city, area), not just per city. A single "PG accommodation in Bengaluru"
    search is capped by Google at 60 results total and returns a geographically-skewed slice —
    nowhere near covering a big city's actual PG/coworking count spread across localities. For
    each requested city, the script looks up its curated Area list from Bhavano's own
    GET /locations/areas (the same one behind the SEO locality pages, seeded in
    apps/bff/prisma/seedCities.ts — "good coverage of major areas, not exhaustive", which is
    exactly the "important areas" bar to use here) and runs one query per area instead of one
    for the whole city. cityId/areaId on the imported OutreachContact row default to this same
    lookup's target, then get refined per-place by reverse-geocoding that place's own exact
    lat/lng (POST /locations/reverse-geocode — the same lookup the web app's map pin-picker
    uses) for a precise Area match, not just "whichever area's search query happened to surface
    it" — see reverse_geocode()/build_contact()'s own docstrings; --no-reverse-geocode disables
    this. Falls back to a single city-level query if the city isn't in Bhavano's DB yet (a
    brand-new city) or --no-areas is passed — reverse-geocoding still applies in that case and
    is what actually assigns an Area at all when there was no known area to start from.
  - No "contact person name" field exists in Places API. OutreachContact has no such column
    either — the business `name` is imported as-is.
  - "description" (editorial summary) and "facilities" (Google's own category `types`, not a
    real amenity list) have no dedicated OutreachContact column — folded into `notes` instead.
  - Imported with consentState left at its default ("none") — a scraped number/email has no
    consent basis for marketing sends until someone reviews and updates it. See the compliance
    notes in docs/plans/outreach-campaign-contacts.md.
  - Uses the legacy Places API (textsearch/details/photo), not "Places API (New)" — requires
    "Places API" enabled and this machine's IP allowlisted on GOOGLE_MAPS_SERVER_KEY's project.
  - Photos have no home on OutreachContact (no such column) — still downloaded locally
    (default on, max 6/place) as a reference for the outreach call, not attached to the row.
  - Auth: mints a short-lived admin JWT locally using AUTH_JWT_SECRET (must match the target
    BFF's own secret — this only works against a BFF instance whose .env has the same value,
    i.e. your local dev BFF by default. Do NOT point --bff-url at production unless you're
    certain AUTH_JWT_SECRET is identical there, which usually isn't a safe assumption).
  - A --state-file (default ./leads_output/fetched_state.json) tracks every (city, area,
    category) already pulled, so a later run skips it — no repeat Places API cost — unless
    --force is passed.

Run: python get_pg_coworking_leads.py --cities "Bengaluru,Pune,Hyderabad"
"""

import argparse
import base64
import hashlib
import hmac
import json
import os
import sys
import time
from datetime import datetime

import requests
from dotenv import load_dotenv

# apps/bff/.env first so its AUTH_JWT_SECRET (the value the target local BFF actually verifies
# against) wins over the root .env's copy if the two ever diverge; load_dotenv() never
# overrides a key that's already in the environment.
load_dotenv("apps/bff/.env")
load_dotenv(".env")

PLACES_BASE = "https://maps.googleapis.com/maps/api/place"
TEXT_SEARCH_URL = f"{PLACES_BASE}/textsearch/json"
DETAILS_URL = f"{PLACES_BASE}/details/json"
PHOTO_URL = f"{PLACES_BASE}/photo"

QUERY_NOUNS = {
    "pg": "PG accommodation",
    "coworking": "coworking space",
}

DETAILS_FIELDS = ",".join(
    [
        "name",
        "formatted_address",
        "formatted_phone_number",
        "website",
        "rating",
        "user_ratings_total",
        "business_status",
        "types",
        "editorial_summary",
        "photos",
        "geometry",
        "url",
    ]
)

# Google requires a short delay before a text-search next_page_token becomes valid.
NEXT_PAGE_DELAY_SECONDS = 2
REQUEST_DELAY_SECONDS = 0.2
RETRYABLE_STATUSES = {"OVER_QUERY_LIMIT", "UNKNOWN_ERROR"}
MAX_RETRIES = 3
JWT_TTL_SECONDS = 3600
# "(city-level)" is a real, non-empty state-file key segment for the no-areas fallback case, so
# it can never collide with an actual area name (which would never contain parentheses like this).
CITY_LEVEL = "(city-level)"


class RequestCounter:
    def __init__(self):
        self.text_search = 0
        self.details = 0
        self.photos = 0

    def summary(self):
        return (
            f"Places API requests — text search: {self.text_search}, "
            f"place details: {self.details}, photos: {self.photos}"
        )


def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def mint_admin_jwt(secret: str, sub: str = "get_pg_coworking_leads_script", role: str = "admin") -> str:
    """A minimal HS256 JWT matching what AuthGuard/extractUser (apps/bff/src/auth/guards/
    auth.guard.ts) verifies: {sub, role}, signed with AUTH_JWT_SECRET. No dependency on
    PyJWT (not installed) — HS256 is short enough to do by hand.

    Default sub/role work for the AdminGuard-protected outreach-import endpoint this script
    calls, which never looks `sub` up as a real row. bulk_upload_listings.py reuses this with
    role="user" and a real User.id as sub, since POST /listings looks that id up for real."""
    header = _b64url(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    now = int(time.time())
    payload = _b64url(
        json.dumps(
            {"sub": sub, "role": role, "iat": now, "exp": now + JWT_TTL_SECONDS},
            separators=(",", ":"),
        ).encode()
    )
    signing_input = f"{header}.{payload}"
    signature = hmac.new(secret.encode(), signing_input.encode(), hashlib.sha256).digest()
    return f"{signing_input}.{_b64url(signature)}"


def lookup_city(bff_url, city_name):
    """GET /locations/cities?q=<name> — public, no auth. Returns the matching {id, name, ...}
    or None if this city isn't in Bhavano's DB yet (a brand-new city not seeded/posted-to
    before), in which case the caller falls back to a city-level-only query."""
    try:
        resp = requests.get(f"{bff_url}/locations/cities", params={"q": city_name}, timeout=15)
        resp.raise_for_status()
        matches = resp.json()
    except requests.RequestException as e:
        print(f"  warning: city lookup failed ({e}) — falling back to city-level query", file=sys.stderr)
        return None
    for m in matches:
        if m["name"].strip().lower() == city_name.strip().lower():
            return m
    return matches[0] if matches else None


def reverse_geocode(bff_url, lat, lng):
    """POST /locations/reverse-geocode — the same Google-backed lookup the web app's own map
    pin-picker uses (apps/bff/src/locations/locations.service.ts), fed here with the Place's own
    geometry.location instead of a manually-dropped pin. Public, no auth. Can both match an
    *existing* Area/City and, per that service's own documented semantics, silently create a new
    one (Area always; City only when the resolved locality+state matches nothing yet) — same
    match-or-create policy a human posting via the map pin-picker already triggers, just applied
    here unattended. Returns None on any failure (network error, or Google returning nothing
    usable) — the caller falls back to the search-query's own city/area in that case."""
    try:
        resp = requests.post(f"{bff_url}/locations/reverse-geocode", json={"lat": lat, "lng": lng}, timeout=15)
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException as e:
        print(f"    warning: reverse-geocode failed ({e}) — keeping search-area assignment", file=sys.stderr)
        return None
    return data if data.get("areaId") else None


def lookup_areas(bff_url, city_id):
    """GET /locations/areas?cityId=...&all=true — the full curated area list (seeded in
    apps/bff/prisma/seedCities.ts, "good coverage of major areas, not exhaustive" — that curation
    itself is the "important areas" signal, there's no separate importance score to rank by)."""
    try:
        resp = requests.get(
            f"{bff_url}/locations/areas", params={"cityId": city_id, "all": "true"}, timeout=15
        )
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException as e:
        print(f"  warning: area lookup failed ({e}) — falling back to city-level query", file=sys.stderr)
        return []


def resolve_locations(bff_url, city, max_areas, no_areas):
    """Returns (cityId, [{"area": name_or_None, "areaId": id_or_None}, ...]). A single
    {"area": None, "areaId": None} entry means city-level-only — either --no-areas, the city
    has no curated areas yet, or the city isn't in Bhavano's DB at all."""
    city_level = [{"area": None, "areaId": None}]
    if no_areas:
        return None, city_level

    city_obj = lookup_city(bff_url, city)
    if not city_obj:
        print(f"  '{city}' not found in Bhavano's City table — city-level query only", file=sys.stderr)
        return None, city_level

    areas = lookup_areas(bff_url, city_obj["id"])
    if not areas:
        print(f"  no curated areas for '{city}' yet — city-level query only", file=sys.stderr)
        return city_obj["id"], city_level

    if max_areas:
        areas = areas[:max_areas]
    return city_obj["id"], [{"area": a["name"], "areaId": a["id"]} for a in areas]


def build_query(category, city, area):
    noun = QUERY_NOUNS[category]
    return f"{noun} in {area}, {city}" if area else f"{noun} in {city}"


def api_get(url, params, counter_attr, counter):
    for attempt in range(1, MAX_RETRIES + 1):
        resp = requests.get(url, params=params, timeout=15)
        setattr(counter, counter_attr, getattr(counter, counter_attr) + 1)
        resp.raise_for_status()
        data = resp.json()
        status = data.get("status")
        if status in ("OK", "ZERO_RESULTS"):
            return data
        if status == "REQUEST_DENIED":
            raise SystemExit(
                "Google Places API request denied: "
                f"{data.get('error_message', '(no error_message)')}\n"
                "Check that 'Places API' (the legacy one, not just Geocoding API) is enabled "
                "for the GCP project behind GOOGLE_MAPS_SERVER_KEY, and that the key isn't "
                "IP-restricted away from this machine."
            )
        if status in RETRYABLE_STATUSES and attempt < MAX_RETRIES:
            time.sleep(1.5 * attempt)
            continue
        raise SystemExit(f"Google Places API error: {status} — {data.get('error_message', '')}")
    raise SystemExit("Google Places API: exhausted retries")


def text_search(api_key, query, max_results, counter):
    results = []
    params = {"query": query, "key": api_key}
    while True:
        data = api_get(TEXT_SEARCH_URL, params, "text_search", counter)
        results.extend(data.get("results", []))
        next_page_token = data.get("next_page_token")
        if not next_page_token or len(results) >= max_results:
            break
        time.sleep(NEXT_PAGE_DELAY_SECONDS)
        params = {"pagetoken": next_page_token, "key": api_key}
    return results[:max_results]


def place_details(api_key, place_id, counter):
    params = {"place_id": place_id, "fields": DETAILS_FIELDS, "key": api_key}
    data = api_get(DETAILS_URL, params, "details", counter)
    return data.get("result", {})


def download_photos(api_key, place_id, photos, out_dir, max_photos, counter):
    photo_dir = os.path.join(out_dir, "photos")
    os.makedirs(photo_dir, exist_ok=True)
    saved_paths = []
    for i, photo in enumerate(photos[:max_photos]):
        photo_reference = photo.get("photo_reference")
        if not photo_reference:
            continue
        params = {"photoreference": photo_reference, "maxwidth": 1024, "key": api_key}
        resp = requests.get(PHOTO_URL, params=params, timeout=20)
        counter.photos += 1
        if resp.status_code != 200:
            continue
        path = os.path.join(photo_dir, f"{place_id}_{i}.jpg")
        with open(path, "wb") as f:
            f.write(resp.content)
        saved_paths.append(path)
        time.sleep(REQUEST_DELAY_SECONDS)
    return saved_paths


def build_contact(city, area, category, query, details, photo_paths, city_id, area_id, bff_url=None, use_geocode=True):
    """Shape a Places Details result into OutreachContactInputDto (apps/bff/src/admin/dto/
    outreach.dto.ts) — only the fields that map onto a real column; description/facilities/
    business status/local photo paths have no column of their own, so they go into `notes`.

    city_id/area_id default to whichever (city, area) search query surfaced this place — accurate
    most of the time, but only as precise as Google's text-search radius for that named area. When
    `use_geocode` and lat/lng are available, reverse_geocode() is tried against the place's own
    exact coordinates for a more precise Area (same lookup the map pin-picker itself uses). Its
    city is only trusted when it agrees with the one actually searched for (or none was known yet,
    e.g. a brand-new city) — a disagreement is kept as the original search-area assignment plus a
    note in `notes`, rather than silently jumping the contact to an unexpected city."""
    location = (details.get("geometry") or {}).get("location") or {}
    lat, lng = location.get("lat"), location.get("lng")
    editorial = (details.get("editorial_summary") or {}).get("overview", "")

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
        f"Business status: {details.get('business_status', 'UNKNOWN')}",
    ]
    if geocode_note:
        notes_parts.append(geocode_note)
    if editorial:
        notes_parts.append(f"Description: {editorial}")
    types = details.get("types", [])
    if types:
        notes_parts.append(f"Google types: {', '.join(types)}")
    if photo_paths:
        notes_parts.append(f"Local photos: {'; '.join(photo_paths)}")

    return {
        "name": details.get("name", "").strip() or "(no name)",
        "phone": details.get("formatted_phone_number") or None,
        "address": details.get("formatted_address") or None,
        "lat": lat,
        "lng": lng,
        "cityId": resolved_city_id,
        "areaId": resolved_area_id,
        "googleRating": details.get("rating"),
        "googleReviewCount": details.get("user_ratings_total"),
        "googlePlaceId": details.get("place_id") or None,
        "businessCategory": category,
        # Structured now (also still folded into `notes` as text above, for anyone reading the
        # freeform history) — the admin "Create listing" bulk action refuses anything but
        # OPERATIONAL/unknown, see OutreachService.createListingFromContact.
        "businessStatus": details.get("business_status") or None,
        "website": details.get("website") or None,
        "sourceRef": query,
        "notes": "\n".join(notes_parts),
    }


def state_key(city, area, category):
    return f"{city.strip().lower()}|{(area or CITY_LEVEL).strip().lower()}|{category}"


def collect_city(api_key, city, city_id, locations, categories, max_results, out_dir, download, max_photos, counter, state, force, min_rating=None, bff_url=None, use_geocode=True):
    """Runs one Places Text Search per (area, category) pair not already in `state` (unless
    force), deduping by place_id across every area/category combo within this city — the same
    PG can plausibly surface from more than one neighbouring area's query — so Place Details is
    never fetched twice for one business. Returns (contacts, pair_counts), where pair_counts
    maps every (area, category) pair actually queried this run to how many places it found (0
    included) — that's what the caller records into the state file.

    `min_rating`, if set, is applied here against the Text Search result's own `rating` field
    (the legacy API returns it directly, no separate Details call needed to see it) — a place
    below the bar, or with no rating at all, never enters `seen` and so never costs a Details or
    Photos call either. The (area, category) pair is still marked fetched in the state file
    either way — the filter shouldn't cause a later run to re-query the same area."""
    seen = {}
    pair_counts = {}
    for loc in locations:
        for category in categories:
            key = state_key(city, loc["area"], category)
            if key in state and not force:
                continue
            pair_counts[(loc["area"], category)] = 0
            query = build_query(category, city, loc["area"])
            print(f"  searching: {query}", file=sys.stderr)
            for result in text_search(api_key, query, max_results, counter):
                place_id = result.get("place_id")
                if not place_id or place_id in seen:
                    continue
                if min_rating is not None and (result.get("rating") or 0) < min_rating:
                    continue
                seen[place_id] = (category, query, loc)

    contacts = []
    for place_id, (category, query, loc) in seen.items():
        time.sleep(REQUEST_DELAY_SECONDS)
        details = place_details(api_key, place_id, counter)
        if not details:
            continue
        details["place_id"] = place_id

        photo_paths = []
        if download:
            photo_paths = download_photos(
                api_key, place_id, details.get("photos", []), out_dir, max_photos, counter
            )

        contacts.append(
            build_contact(
                city, loc["area"], category, query, details, photo_paths, city_id, loc["areaId"],
                bff_url=bff_url, use_geocode=use_geocode,
            )
        )
        pair_counts[(loc["area"], category)] += 1
    return contacts, pair_counts


def import_contacts(bff_url, token, contacts):
    resp = requests.post(
        f"{bff_url}/admin/outreach/contacts/import",
        json={"source": "google_maps", "contacts": contacts},
        headers={"Authorization": f"Bearer {token}"},
        timeout=60,
    )
    if resp.status_code in (401, 403):
        raise SystemExit(
            f"Import rejected ({resp.status_code}): {resp.text}\n"
            "The minted JWT's signature didn't match — check AUTH_JWT_SECRET in apps/bff/.env "
            "matches whatever's actually running at --bff-url."
        )
    resp.raise_for_status()
    return resp.json()


def parse_cities(args):
    if args.cities_file:
        with open(args.cities_file) as f:
            return [line.strip() for line in f if line.strip()]
    return [c.strip() for c in args.cities.split(",") if c.strip()]


def load_state(path):
    if not os.path.exists(path):
        return {}
    with open(path) as f:
        return json.load(f)


def save_state(path, state):
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w") as f:
        json.dump(state, f, indent=2, sort_keys=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--cities", help="Comma-separated city names, e.g. 'Bengaluru,Pune'")
    parser.add_argument("--cities-file", help="Path to a file with one city name per line")
    parser.add_argument(
        "--categories",
        default="pg,coworking",
        help="Comma-separated: pg, coworking, or both (default: both)",
    )
    parser.add_argument("--max-results", type=int, default=40, help="Max results per (area, category) query (default 40)")
    parser.add_argument(
        "--min-rating",
        type=float,
        default=None,
        help="Only keep places with a Google rating >= this (e.g. 4.0). Filtered out before "
        "Place Details/photos are fetched, so it also cuts API cost, not just the output. A "
        "place with no rating at all (no reviews yet) is excluded whenever this is set.",
    )
    parser.add_argument(
        "--no-reverse-geocode",
        action="store_true",
        help="Skip reverse-geocoding each place's exact lat/lng for a precise City/Area match "
        "(POST /locations/reverse-geocode — the same lookup the map pin-picker uses). On by "
        "default; disabling it falls back to assigning whichever (city, area) the search query "
        "itself targeted, which is faster and doesn't spend extra Google Geocoding API quota on "
        "the GOOGLE_MAPS_SERVER_KEY project, but is only as precise as that query's search radius.",
    )
    parser.add_argument(
        "--no-areas",
        action="store_true",
        help="Skip Bhavano's curated-area expansion, query at the city level only (old behaviour)",
    )
    parser.add_argument(
        "--max-areas-per-city",
        type=int,
        default=None,
        help="Cap how many of a city's curated areas to query (default: all of them)",
    )
    parser.add_argument("--bff-url", default="http://localhost:4000", help="BFF base URL (default http://localhost:4000)")
    parser.add_argument("--photos-dir", default="./leads_output", help="Where downloaded photos are saved (default ./leads_output)")
    parser.add_argument("--no-photos", action="store_true", help="Don't download photos at all")
    parser.add_argument("--max-photos", type=int, default=6, help="Max photos to fetch per place (default 6)")
    parser.add_argument("--dry-run", action="store_true", help="Fetch and print counts, but don't POST to the BFF")
    parser.add_argument(
        "--state-file",
        default="./leads_output/fetched_state.json",
        help="Tracks which (city, area, category) triples were already fetched, so re-running "
        "the script skips them instead of burning API quota on the same location again "
        "(default ./leads_output/fetched_state.json)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Refetch every requested (city, area, category) triple even if the state file says it's already done",
    )
    args = parser.parse_args()

    if not args.cities and not args.cities_file:
        parser.error("one of --cities or --cities-file is required")

    api_key = os.environ.get("GOOGLE_MAPS_SERVER_KEY")
    if not api_key:
        raise SystemExit("GOOGLE_MAPS_SERVER_KEY not found — check .env")

    jwt_secret = os.environ.get("AUTH_JWT_SECRET")
    if not args.dry_run and not jwt_secret:
        raise SystemExit("AUTH_JWT_SECRET not found — check apps/bff/.env")

    categories = [c.strip() for c in args.categories.split(",") if c.strip()]
    for c in categories:
        if c not in QUERY_NOUNS:
            raise SystemExit(f"Unknown category '{c}' — must be one of {list(QUERY_NOUNS)}")

    cities = parse_cities(args)
    os.makedirs(args.photos_dir, exist_ok=True)
    state = load_state(args.state_file)

    counter = RequestCounter()
    all_contacts = []
    for city in cities:
        print(f"Resolving locations for {city}...", file=sys.stderr)
        city_id, locations = resolve_locations(args.bff_url, city, args.max_areas_per_city, args.no_areas)
        area_label = "city-level only" if len(locations) == 1 and locations[0]["area"] is None else f"{len(locations)} areas"
        print(f"  {area_label}", file=sys.stderr)

        already_done = [
            (loc["area"], cat)
            for loc in locations
            for cat in categories
            if state_key(city, loc["area"], cat) in state
        ]
        if already_done and not args.force:
            print(
                f"  skipping {len(already_done)} already-fetched (area, category) pairs "
                f"(see {args.state_file}; use --force to refetch)",
                file=sys.stderr,
            )

        contacts, pair_counts = collect_city(
            api_key,
            city,
            city_id,
            locations,
            categories,
            args.max_results,
            args.photos_dir,
            not args.no_photos,
            args.max_photos,
            counter,
            state,
            args.force,
            args.min_rating,
            args.bff_url,
            not args.no_reverse_geocode,
        )
        all_contacts.extend(contacts)

        fetched_at = datetime.now().isoformat(timespec="seconds")
        for (area, category), count in pair_counts.items():
            state[state_key(city, area, category)] = {
                "city": city,
                "area": area,
                "category": category,
                "fetchedAt": fetched_at,
                "placeCount": count,
            }
        # Saved after every city, not just at the end, so an interrupted multi-city run still
        # remembers the cities/areas it already finished.
        save_state(args.state_file, state)

    print(f"\nFetched {len(all_contacts)} places total.", file=sys.stderr)
    print(counter.summary(), file=sys.stderr)

    if args.dry_run:
        print("\n--dry-run: not importing into OutreachContact.", file=sys.stderr)
        return

    if not all_contacts:
        print("\nNothing new to import.", file=sys.stderr)
        return

    token = mint_admin_jwt(jwt_secret)
    result = import_contacts(args.bff_url, token, all_contacts)
    print(
        f"\nImported into OutreachContact — created: {result.get('created', 0)}, "
        f"updated: {result.get('updated', 0)}, skipped (no phone/email): {result.get('skipped', 0)}",
        file=sys.stderr,
    )
    print("consentState defaults to 'none' — review in /outreach/contacts before campaigning.", file=sys.stderr)


if __name__ == "__main__":
    main()
