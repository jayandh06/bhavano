"""Bulk-create real Listings from a hand-completed CSV (see
export_outreach_contacts_for_listings.py), calling the actual listing API — not a direct DB
write — so every normal rule still applies: category-attribute validation
(ListingsService.assertValidAttributes), moderation, photo limits, the works.

Every listing is posted under one dedicated "Bulk Import" owner account (see
apps/bff/prisma/seedBulkImportOwner.ts — run `pnpm --filter @bhavano/bff
prisma:seed:bulk-import-owner` once to create it and get its id), not a real business's own
account — nothing here impersonates the scraped business. Listing.source stays at its default
("direct") since this endpoint has no way to set it yet; that's a known gap, not silently wrong.

Each row must already have every field a real posting would need — transactionType and the
category's required attribute (pg: sharingType, coworking: seatType) — this script refuses to
invent them. price is the one exception: leave it "0" for pg/coworking to post as "Contact for
price" (plans vary, owner hasn't set one yet) rather than guessing a number — any other category
still needs a real positive price. A row missing anything else required, or with no local photos
found for its googlePlaceId under --photos-dir/photos/, is skipped and reported, never defaulted.

Photos are the ones get_pg_coworking_leads.py already downloaded locally — re-review the rights
question before actually doing this for real: these are Google's photos, not the business's own
submission, and the listing will show them as if they were.

Run: python bulk_upload_listings.py --csv leads_output/for_listings.csv --owner-id <id>
"""

import argparse
import csv
import glob
import json
import os
import sys
import uuid

import requests
from dotenv import load_dotenv

from get_pg_coworking_leads import mint_admin_jwt
from export_outreach_contacts_for_listings import ATTRIBUTE_COLUMNS, POSTABLE_TRANSACTION_TYPES

load_dotenv("apps/bff/.env")
load_dotenv(".env")

MAX_PHOTOS = 6


def attribute_key(column_name):
    """"attr_sharingType_REQUIRED" -> "sharingType"; "attr_amenities" -> "amenities"."""
    key = column_name[len("attr_"):]
    if key.endswith("_REQUIRED"):
        key = key[: -len("_REQUIRED")]
    return key


def required_attribute_column(category):
    for col in ATTRIBUTE_COLUMNS.get(category, []):
        if col.endswith("_REQUIRED"):
            return col
    return None


def validate_row(row):
    """Returns an error string, or None if the row is postable as-is."""
    category = row.get("category", "").strip()
    if category not in ATTRIBUTE_COLUMNS:
        return f"unsupported category '{category}'"
    if not row.get("title", "").strip():
        return "missing title"
    transaction_type = row.get("transactionType", "").strip()
    if transaction_type not in POSTABLE_TRANSACTION_TYPES.get(category, set()):
        return f"transactionType '{transaction_type}' invalid for {category} (allowed: {POSTABLE_TRANSACTION_TYPES[category]})"
    price = row.get("price", "").strip()
    if not price.isdigit():
        return f"price must be a non-negative integer, got '{price}'"
    # 0 ("Contact for price") is only valid for pg/coworking — ListingsService.assertValidPrice
    # enforces the same rule server-side; checked here too so a bad row fails fast, before any
    # photo upload, with a clear reason instead of a generic 400 from the API.
    if int(price) == 0 and category not in ("pg", "coworking"):
        return f"price 0 ('Contact for price') isn't valid for category '{category}'"
    if not row.get("cityId", "").strip():
        return "missing cityId"
    required_col = required_attribute_column(category)
    if required_col and not row.get(required_col, "").strip():
        return f"missing required attribute column '{required_col}'"
    return None


def build_attributes(row):
    attrs = {}
    for col in row:
        if col.startswith("attr_"):
            value = row[col].strip()
            if value:
                attrs[attribute_key(col)] = value
    return attrs


def find_photos(photos_dir, google_place_id, max_photos):
    if not google_place_id:
        return []
    pattern = os.path.join(photos_dir, "photos", f"{google_place_id}_*.jpg")
    return sorted(glob.glob(pattern))[:max_photos]


def upload_photo(bff_url, token, listing_id, photo_no, path):
    with open(path, "rb") as f:
        resp = requests.post(
            f"{bff_url}/uploads",
            data={"listingId": listing_id, "photoNo": photo_no},
            files={"file": (os.path.basename(path), f, "image/jpeg")},
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
        )
    resp.raise_for_status()
    result = resp.json()
    return {"photoNo": photo_no, "hash": result["hash"], "ext": result["ext"]}


def create_listing(bff_url, token, payload):
    resp = requests.post(
        f"{bff_url}/listings",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
        timeout=30,
    )
    return resp


def send_claim_whatsapp(bff_url, admin_token, contact_id):
    """POST /admin/outreach/contacts/:id/send-claim-whatsapp — see
    OutreachService.sendClaimVerification. Requires MSG91_MARKETING_ENABLED=true and the
    MSG91_WHATSAPP_CLAIM_TEMPLATE_NAME/_NAMESPACE env vars set on the BFF; returns a clear
    `reason` rather than sending if either is missing, an opt-out/suppression matches, or the
    listing's already claimed — never raises for those, only for a genuine HTTP-level failure."""
    resp = requests.post(
        f"{bff_url}/admin/outreach/contacts/{contact_id}/send-claim-whatsapp",
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--csv", required=True, help="Hand-completed CSV from export_outreach_contacts_for_listings.py")
    parser.add_argument("--owner-id", required=True, help="The bulk-import account's user id (from seedBulkImportOwner.ts)")
    parser.add_argument("--photos-dir", default="./leads_output", help="Where get_pg_coworking_leads.py saved photos (default ./leads_output)")
    parser.add_argument("--bff-url", default="http://localhost:4000", help="BFF base URL (default http://localhost:4000)")
    parser.add_argument("--max-photos", type=int, default=MAX_PHOTOS, help=f"Max photos per listing (API caps at {MAX_PHOTOS})")
    parser.add_argument("--dry-run", action="store_true", help="Validate every row and report what would happen, without uploading anything")
    parser.add_argument(
        "--send-whatsapp",
        action="store_true",
        help="After each successful listing creation, send the 'verify your listing' WhatsApp "
        "via MSG91 to the business's phone (see OutreachService.sendClaimVerification). "
        "Requires MSG91_MARKETING_ENABLED=true and the MSG91_WHATSAPP_CLAIM_* env vars set on "
        "the BFF, and only applies to rows that had a contactId (skipped otherwise).",
    )
    args = parser.parse_args()

    jwt_secret = os.environ.get("AUTH_JWT_SECRET")
    if not jwt_secret:
        raise SystemExit("AUTH_JWT_SECRET not found — check apps/bff/.env")
    # role="user" and a real User.id, unlike get_pg_coworking_leads.py's own default use of this
    # function — POST /listings looks `sub` up as a real row (see ListingsService.create), unlike
    # the admin-only outreach-import endpoint that script calls.
    token = mint_admin_jwt(jwt_secret, sub=args.owner_id, role="user")
    # Separate token, default sub/role (admin) — POST /admin/outreach/contacts/:id/send-claim-
    # whatsapp is AdminGuard-protected, unlike listing creation above.
    admin_token = mint_admin_jwt(jwt_secret)

    with open(args.csv, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    created, skipped, failed = [], [], []
    whatsapp_sent, whatsapp_skipped = [], []
    for i, row in enumerate(rows, start=1):
        label = row.get("title") or row.get("googlePlaceId") or f"row {i}"

        error = validate_row(row)
        if error:
            skipped.append((label, error))
            continue

        photos = find_photos(args.photos_dir, row.get("googlePlaceId", "").strip(), args.max_photos)
        if not photos:
            skipped.append((label, f"no local photos found under {args.photos_dir}/photos/ for this googlePlaceId — the API requires at least one"))
            continue

        listing_id = str(uuid.uuid4())
        payload = {
            "id": listing_id,
            "category": row["category"].strip(),
            "transactionType": row["transactionType"].strip(),
            "price": int(row["price"].strip()),
            "title": row["title"].strip(),
            "cityId": row["cityId"].strip(),
            "attributes": build_attributes(row),
            "photos": [],
        }
        if row.get("contactId", "").strip():
            # Links the listing back to its OutreachContact so the real owner can claim it later
            # via WhatsApp + OTP — see ListingsService.claimListing.
            payload["claimContactId"] = row["contactId"].strip()
        if row.get("priceQualifier", "").strip():
            payload["priceQualifier"] = row["priceQualifier"].strip()
        if row.get("areaName", "").strip():
            payload["areaName"] = row["areaName"].strip()
        if row.get("description", "").strip():
            payload["description"] = row["description"].strip()
        if row.get("lat", "").strip() and row.get("lng", "").strip():
            payload["lat"] = float(row["lat"])
            payload["lng"] = float(row["lng"])

        if args.dry_run:
            print(f"[dry-run] would create '{label}' with {len(photos)} photo(s): {json.dumps(payload)}", file=sys.stderr)
            created.append(label)
            continue

        try:
            for photo_no, path in enumerate(photos, start=1):
                payload["photos"].append(upload_photo(args.bff_url, token, listing_id, photo_no, path))
        except requests.RequestException as e:
            failed.append((label, f"photo upload failed: {e}"))
            continue

        resp = create_listing(args.bff_url, token, payload)
        if resp.status_code >= 400:
            failed.append((label, f"{resp.status_code}: {resp.text}"))
            continue

        created.append(label)
        print(f"created: {label} -> listing {listing_id}", file=sys.stderr)

        if args.send_whatsapp and payload.get("claimContactId"):
            try:
                result = send_claim_whatsapp(args.bff_url, admin_token, payload["claimContactId"])
            except requests.RequestException as e:
                whatsapp_skipped.append((label, f"request failed: {e}"))
            else:
                if result.get("sent"):
                    whatsapp_sent.append(label)
                    print(f"  whatsapp sent to {label}'s owner", file=sys.stderr)
                else:
                    whatsapp_skipped.append((label, result.get("reason", "unknown reason")))

    print(f"\n{len(created)} created, {len(skipped)} skipped, {len(failed)} failed.", file=sys.stderr)
    if skipped:
        print("\nSkipped (fix the CSV and re-run — safe, nothing was created for these):", file=sys.stderr)
        for label, reason in skipped:
            print(f"  {label}: {reason}", file=sys.stderr)
    if failed:
        print("\nFailed (API rejected these — check the error):", file=sys.stderr)
        for label, reason in failed:
            print(f"  {label}: {reason}", file=sys.stderr)
    if args.send_whatsapp:
        print(f"\nWhatsApp: {len(whatsapp_sent)} sent, {len(whatsapp_skipped)} not sent.", file=sys.stderr)
        if whatsapp_skipped:
            for label, reason in whatsapp_skipped:
                print(f"  {label}: {reason}", file=sys.stderr)


if __name__ == "__main__":
    main()
