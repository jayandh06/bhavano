"""Export OutreachContact rows (see get_pg_coworking_leads.py) to a CSV shaped for hand
review/completion, then bulk-upload into real Listings with bulk_upload_listings.py.

Google Places data alone isn't enough to post a valid listing — price, transactionType, and
category-required attributes (pg needs sharingType, coworking needs seatType) don't exist in
Places data and must never be invented. This script pre-fills every column it actually knows
(name, address, lat/lng, cityId/areaId, googlePlaceId, a sensible default transactionType) and
leaves the rest blank for a human to fill in before running the bulk uploader. Rows with no
required column filled in by the time of upload are skipped there, not fabricated here.

Exception: `price` can legitimately be left as "0" for pg/coworking rows — posts as "Contact for
price" when plans vary by option and there's no single number to set yet (see
ListingsService.assertValidPrice). Every other category still needs a real positive price.

`contactId` (the OutreachContact's own id, not googlePlaceId) is carried straight through to
bulk_upload_listings.py, which sends it as the new listing's claimContactId — this is what lets
the real business owner later "claim" the listing via a WhatsApp link + OTP verification against
this contact's phone number (see ListingsService.claimListing). Don't edit this column by hand.

Run: python export_outreach_contacts_for_listings.py --category pg --out leads_output/for_listings.csv
"""

import argparse
import csv
import os
import re
import sys

import requests
from dotenv import load_dotenv

from get_pg_coworking_leads import mint_admin_jwt

load_dotenv("apps/bff/.env")
load_dotenv(".env")

# transactionTypes each category actually accepts — packages/types/src/postingRules.ts.
# Shared with bulk_upload_listings.py, which imports these to validate rows before posting.
POSTABLE_TRANSACTION_TYPES = {"pg": {"rent"}, "coworking": {"rent", "lease"}}
DEFAULT_TRANSACTION_TYPE = {"pg": "rent", "coworking": "rent"}

# pg's "gender" field ("Preferred for") is multi-select — packages/types/src/categoryFields.ts —
# so more than one of these can apply at once (e.g. "Gents and Ladies" matches both). Deliberately
# NOT matching bare "men"/"women": "women" itself contains "men" as a substring, so that would
# tag every women-only PG as also-for-men. \b word boundaries additionally stop a keyword from
# matching inside an unrelated longer word.
MEN_NAME_KEYWORDS = re.compile(r"\b(gents?|boys?)\b", re.IGNORECASE)
WOMEN_NAME_KEYWORDS = re.compile(r"\b(ladies|girls?)\b", re.IGNORECASE)
# Covers "coliving", "co-living", "co living", "colive", "co-live", "co live".
COLIVING_NAME_KEYWORDS = re.compile(r"\bco[\s-]?liv(?:e|ing)\b", re.IGNORECASE)


def guess_gender(name):
    """Best-effort "Preferred for" suggestion from a scraped business name — never a guess when
    there's no signal at all (returns ""), and never overrides a human's own judgement: this only
    pre-fills the CSV cell, which stays fully editable before upload. Encoded as `;`-joined values
    for build_attributes() in bulk_upload_listings.py, which is what actually turns this into the
    string[] the multi-select field expects."""
    if COLIVING_NAME_KEYWORDS.search(name):
        return "coed;men;women"
    values = []
    if MEN_NAME_KEYWORDS.search(name):
        values.append("men")
    if WOMEN_NAME_KEYWORDS.search(name):
        values.append("women")
    return ";".join(values)

# Mirrors ListingsService.PRICE_ON_REQUEST_CATEGORIES — these are the only categories where
# price: 0 ("Contact for price") is a valid posting, so it's the only default worth pre-filling.
PRICE_ON_REQUEST_CATEGORIES = {"pg", "coworking"}

# Category-required/optional attribute columns — apps/bff/prisma/../categoryFields.ts
# CATEGORY_FIELD_CONFIG's pg/coworking entries. Required ones are marked in the header so a
# human filling the CSV knows which blanks block the upload.
ATTRIBUTE_COLUMNS = {
    "pg": ["attr_sharingType_REQUIRED", "attr_gender", "attr_meals"],
    "coworking": ["attr_seatType_REQUIRED", "attr_amenities"],
}

BASE_COLUMNS = [
    "contactId",
    "googlePlaceId",
    "category",
    "title",
    "transactionType",
    "price",
    "priceQualifier",
    "cityId",
    "areaName",
    "description",
    "lat",
    "lng",
]
REFERENCE_COLUMNS = ["name", "phone", "website", "address", "googleRating", "notes"]


def fetch_all_contacts(bff_url, token, business_category, city_id):
    items = []
    offset = 0
    limit = 100
    while True:
        params = {"offset": offset, "limit": limit}
        if business_category:
            params["businessCategory"] = business_category
        if city_id:
            params["cityId"] = city_id
        resp = requests.get(
            f"{bff_url}/admin/outreach/contacts",
            params=params,
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        items.extend(data["items"])
        offset += limit
        if offset >= data["total"]:
            break
    return items


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--category", help="Only export this businessCategory (e.g. pg, coworking). Omit for all.")
    parser.add_argument("--city-id", help="Only export contacts in this Bhavano cityId. Omit for all.")
    parser.add_argument("--bff-url", default="http://localhost:4000", help="BFF base URL (default http://localhost:4000)")
    parser.add_argument("--out", default="./leads_output/for_listings.csv", help="Output CSV path")
    args = parser.parse_args()

    jwt_secret = os.environ.get("AUTH_JWT_SECRET")
    if not jwt_secret:
        raise SystemExit("AUTH_JWT_SECRET not found — check apps/bff/.env")

    token = mint_admin_jwt(jwt_secret)
    contacts = fetch_all_contacts(args.bff_url, token, args.category, args.city_id)
    if not contacts:
        print("No matching OutreachContact rows found.", file=sys.stderr)
        return

    categories_present = sorted({c["businessCategory"] for c in contacts if c.get("businessCategory") in ATTRIBUTE_COLUMNS})
    attr_columns = [col for cat in categories_present for col in ATTRIBUTE_COLUMNS[cat]]
    fieldnames = BASE_COLUMNS + attr_columns + REFERENCE_COLUMNS

    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with open(args.out, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        skipped_unsupported = 0
        for c in contacts:
            category = c.get("businessCategory")
            if category not in ATTRIBUTE_COLUMNS:
                # Not a category this tool knows the required-attribute shape for yet — export
                # what's known, blank attribute columns, never guess at a schema we don't have.
                skipped_unsupported += 1
            row = {
                "contactId": c.get("id") or "",
                "googlePlaceId": c.get("googlePlaceId") or "",
                "category": category or "",
                "title": c.get("name") or "",
                "transactionType": DEFAULT_TRANSACTION_TYPE.get(category, ""),
                # Pre-filled "0" (not blank) for pg/coworking — a real, upload-ready default
                # ("Contact for price") rather than forcing a human to type 0 for every lead with
                # unknown pricing. Overwrite with a real number for any row where it IS known.
                "price": "0" if category in PRICE_ON_REQUEST_CATEGORIES else "",
                "priceQualifier": "",
                "cityId": c.get("cityId") or "",
                "areaName": c.get("areaName") or "",
                "description": "",
                "lat": c.get("lat") if c.get("lat") is not None else "",
                "lng": c.get("lng") if c.get("lng") is not None else "",
                "name": c.get("name") or "",
                "phone": c.get("phoneE164") or c.get("phone") or "",
                "website": c.get("website") or "",
                "address": c.get("address") or "",
                "googleRating": c.get("googleRating") if c.get("googleRating") is not None else "",
                "notes": (c.get("notes") or "").replace("\n", " | "),
            }
            for col in attr_columns:
                row.setdefault(col, "")
            if category == "pg" and "attr_gender" in attr_columns:
                row["attr_gender"] = guess_gender(c.get("name") or "")
            writer.writerow(row)

    print(f"Wrote {len(contacts)} rows to {args.out}", file=sys.stderr)
    if skipped_unsupported:
        print(
            f"{skipped_unsupported} row(s) have a businessCategory this tool doesn't know the "
            "attribute columns for (only pg/coworking are wired up) — exported with blank "
            "attribute columns; add support in ATTRIBUTE_COLUMNS before filling those in.",
            file=sys.stderr,
        )
    print(
        "\nFill in blanks before uploading — REQUIRED columns: title, transactionType, cityId, "
        "and every *_REQUIRED attribute column for that row's category. "
        "price defaults to \"0\" (posts as \"Contact for price\") for pg/coworking — overwrite "
        "it with a real number for any row where the price is actually known. "
        "Then: python bulk_upload_listings.py --csv " + args.out,
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
