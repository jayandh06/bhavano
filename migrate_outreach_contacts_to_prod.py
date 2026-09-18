"""Move OutreachContact rows from one Bhavano BFF/DB (default: local dev) to another (e.g.
production), via the same admin HTTP API the scrapers already use — never a direct DB copy, so
every normal rule still applies (AdminGuard auth, the import endpoint's own upsert-by-
googlePlaceId logic).

Why this exists: get_pg_coworking_leads.py/get_pg_coworking_leads_apify.py always write to
whichever single --bff-url they were pointed at. Today's coworking scrape ran entirely against
localhost:4000 (deliberately — see docs/plans/pg-coworking-scraping-api-costs.md and this
session's own transcript for why: no verified production BFF URL, no confirmed-matching
AUTH_JWT_SECRET, and Apify spend that would have been wasted twice over re-scraping against a
possibly-misconfigured target). This script moves the *already-scraped* rows afterward instead of
re-scraping — no new Apify cost, just an HTTP read from --source-bff-url and an HTTP write to
--target-bff-url.

What does NOT move:
  - `placesFetchLogId` — a foreign key to a PlacesFetchLog row that only exists in the source DB.
    Carrying the source's id over would either dangle or violate a FK constraint on the target,
    so this is always dropped (set to None) on the target-side payload, never copied.
  - `cityId`/`areaId` — these are DB-generated cuids, different per database. Re-resolved by NAME
    (cityName/areaName from the source read) against the *target's* own City/Area tables via the
    same lookup_city()/lookup_areas() this repo's scrapers already use — an unmatched name still
    migrates, just without that FK link, same graceful-degrade every other script here uses.
  - Downloaded photo files. OutreachContact has no photo column (see
    get_pg_coworking_leads.py's own docstring) — photos referenced in `notes` as local file paths
    exist only on whatever machine ran the scrape. Moving contact rows does not copy image files;
    if a contact is later converted to a real Listing via createListingFromContact, the target
    server's own SCRAPED_PHOTOS_DIR needs those files present separately (rsync/copy them there
    yourself — this script has no opinion on how).

Idempotent: the import endpoint upserts by googlePlaceId when present (create otherwise), so
running this twice against the same target updates rather than duplicates.

Run: python migrate_outreach_contacts_to_prod.py --target-bff-url https://<real-prod-url> \
       --business-category coworking
     (add --dry-run first to see counts without writing anything to --target-bff-url)
"""

import argparse
import sys
import time

import requests
from dotenv import load_dotenv

from get_pg_coworking_leads import mint_admin_jwt, lookup_city, lookup_areas

load_dotenv("apps/bff/.env")
load_dotenv(".env")

PAGE_SIZE = 100  # ListOutreachContactsDto caps `limit` at 100 server-side.
IMPORT_BATCH_SIZE = 20  # Same Express default-body-size reasoning as the apify script's own.
REQUEST_DELAY_SECONDS = 0.1


def fetch_all_contacts(bff_url, token, business_category):
    """Pages through GET /admin/outreach/contacts?businessCategory=... until exhausted."""
    contacts = []
    offset = 0
    while True:
        resp = requests.get(
            f"{bff_url}/admin/outreach/contacts",
            params={"businessCategory": business_category, "limit": PAGE_SIZE, "offset": offset},
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        items = data.get("items", [])
        contacts.extend(items)
        offset += len(items)
        if len(items) < PAGE_SIZE or offset >= data.get("total", 0):
            break
    return contacts


def resolve_target_location(target_bff_url, city_name, area_name, location_cache):
    """Re-resolves a source contact's (cityName, areaName) strings against the *target*
    database's own City/Area tables — cuids differ per database, so the source's cityId/areaId
    would be meaningless (or actively wrong, if they happen to collide with an unrelated row) on
    the target. Caches per (city_name, area_name) pair since many contacts share the same one and
    each lookup is a real HTTP round trip."""
    if not city_name:
        return None, None
    key = (city_name, area_name)
    if key in location_cache:
        return location_cache[key]

    city = lookup_city(target_bff_url, city_name)
    city_id = city["id"] if city else None
    area_id = None
    if city_id and area_name:
        for a in lookup_areas(target_bff_url, city_id):
            if a["name"].strip().lower() == area_name.strip().lower():
                area_id = a["id"]
                break
    location_cache[key] = (city_id, area_id)
    return city_id, area_id


def build_target_contact(source_contact, target_bff_url, location_cache):
    """OutreachContactDto (read shape) -> CreateOutreachContactInput (import shape). Only carries
    fields the import endpoint actually accepts — placesFetchLogId is deliberately never copied
    (see module docstring)."""
    city_id, area_id = resolve_target_location(
        target_bff_url, source_contact.get("cityName"), source_contact.get("areaName"), location_cache
    )
    return {
        "name": source_contact["name"],
        "phone": source_contact.get("phone"),
        "email": source_contact.get("email"),
        "address": source_contact.get("address"),
        "lat": source_contact.get("lat"),
        "lng": source_contact.get("lng"),
        "cityId": city_id,
        "areaId": area_id,
        "googleRating": source_contact.get("googleRating"),
        "googleReviewCount": source_contact.get("googleReviewCount"),
        "googlePlaceId": source_contact.get("googlePlaceId"),
        "businessCategory": source_contact.get("businessCategory"),
        "businessStatus": source_contact.get("businessStatus"),
        "website": source_contact.get("website"),
        # placesFetchLogId intentionally omitted — see module docstring.
        "source": source_contact.get("source") or "google_maps",
        "sourceRef": source_contact.get("sourceRef"),
        "tags": source_contact.get("tags") or [],
        "notes": source_contact.get("notes"),
        "consentState": source_contact.get("consentState") or "none",
    }


def import_batch(target_bff_url, token, source, contacts):
    resp = requests.post(
        f"{target_bff_url}/admin/outreach/contacts/import",
        json={"source": source, "contacts": contacts},
        headers={"Authorization": f"Bearer {token}"},
        timeout=60,
    )
    if resp.status_code in (401, 403):
        raise SystemExit(
            f"Import rejected ({resp.status_code}): {resp.text}\n"
            "The minted JWT's signature didn't match --target-bff-url's own AUTH_JWT_SECRET — "
            "this almost certainly means the local secret does NOT match production's. Stop and "
            "re-verify before retrying; do not assume this is transient."
        )
    resp.raise_for_status()
    return resp.json()


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--source-bff-url", default="http://localhost:4000", help="Where to read contacts from (default: local dev)")
    parser.add_argument("--target-bff-url", required=True, help="Where to write contacts to — the real production BFF URL, never guessed")
    parser.add_argument("--business-category", default="coworking", help="Only migrate contacts of this businessCategory (default: coworking)")
    parser.add_argument("--dry-run", action="store_true", help="Fetch and resolve, but don't write anything to --target-bff-url")
    parser.add_argument(
        "--target-auth-secret",
        default=__import__("os").environ.get("TARGET_AUTH_JWT_SECRET"),
        help="AUTH_JWT_SECRET for --target-bff-url (defaults to TARGET_AUTH_JWT_SECRET env var). "
        "Deliberately separate from the source's own secret below — source and target are "
        "different deployments with different secrets, so one shared AUTH_JWT_SECRET can't "
        "authenticate both at once.",
    )
    args = parser.parse_args()

    import dotenv as _dotenv

    # Read the source's own secret straight from its .env file, not the process environment —
    # a caller passing AUTH_JWT_SECRET=<target's secret> on the command line (to authenticate
    # against --target-bff-url) would otherwise shadow apps/bff/.env's value here, breaking the
    # source read with a 401 from the wrong secret. Source and target are different deployments;
    # neither one's secret belongs in a shared env var both sides read from.
    source_secret = _dotenv.dotenv_values("apps/bff/.env").get("AUTH_JWT_SECRET")
    if not source_secret:
        raise SystemExit("AUTH_JWT_SECRET not found in apps/bff/.env — needed to read from --source-bff-url")
    source_token = mint_admin_jwt(source_secret, sub="migrate_outreach_contacts_script")

    if not args.target_auth_secret:
        raise SystemExit(
            "--target-auth-secret (or TARGET_AUTH_JWT_SECRET) is required — the secret that "
            "signs valid admin JWTs for --target-bff_url, which is never the same value as the "
            "source's own AUTH_JWT_SECRET."
        )
    target_token = mint_admin_jwt(args.target_auth_secret, sub="migrate_outreach_contacts_script")

    print(f"Fetching '{args.business_category}' contacts from {args.source_bff_url}...", file=sys.stderr)
    source_contacts = fetch_all_contacts(args.source_bff_url, source_token, args.business_category)
    print(f"  found {len(source_contacts)} contacts", file=sys.stderr)

    location_cache = {}
    target_contacts = [build_target_contact(c, args.target_bff_url, location_cache) for c in source_contacts]
    unresolved = sum(1 for c in target_contacts if c["cityId"] is None)
    if unresolved:
        print(f"  warning: {unresolved} contacts have no matching city on the target — will import with no cityId/areaId", file=sys.stderr)

    if args.dry_run:
        print(f"\n--dry-run: would import {len(target_contacts)} contacts into {args.target_bff_url}. Nothing written.", file=sys.stderr)
        return

    totals = {"created": 0, "updated": 0, "skipped": 0}
    for i in range(0, len(target_contacts), IMPORT_BATCH_SIZE):
        batch = target_contacts[i : i + IMPORT_BATCH_SIZE]
        result = import_batch(args.target_bff_url, target_token, "google_maps", batch)
        totals["created"] += result.get("created", 0)
        totals["updated"] += result.get("updated", 0)
        totals["skipped"] += result.get("skipped", 0)
        print(f"  batch {i // IMPORT_BATCH_SIZE + 1}: created {result.get('created', 0)}, updated {result.get('updated', 0)}, skipped {result.get('skipped', 0)}", file=sys.stderr)
        time.sleep(REQUEST_DELAY_SECONDS)

    print(
        f"\nMigrated into {args.target_bff_url} — created: {totals['created']}, "
        f"updated: {totals['updated']}, skipped (no phone/email): {totals['skipped']}",
        file=sys.stderr,
    )
    print(
        "Reminder: downloaded photo files were NOT moved — only the contact rows. If any of "
        "these get converted to a real Listing later, its photos need to exist under the "
        "target server's own SCRAPED_PHOTOS_DIR separately.",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
