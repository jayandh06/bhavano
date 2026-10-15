"""Find real-estate agent firms that advertise on 99acres and Housing.com, then look each firm up on
Google Maps for a business phone, website and address. Both portals mask the poster's phone, so
the portals only tell us WHO is advertising (firm, city, locality, how many listings); Google Maps
supplies the contact details, which the firm publishes itself.

See docs/plans/99acres-poster-sms-outreach.md for why this shape (no portal exposes poster phones;
an Actor that returned them would be bypassing a login wall, and this script deliberately does not).

Pipeline
  1. Portals:   one Apify Actor run per (portal, city, market) for dealer/agent listings only.
                Individual owners and builders are dropped, so no private person's number is sought.
  2. Merge:     rows collapse to one firm per (city, normalised firm name), across both portals.
  3. Match:     one Google Maps Actor run per firm; the best candidate is scored on name similarity,
                locality in the address, and the portal's masked-phone prefix (e.g. "98200.....").
  4. Output:    <out-dir>/firms_<run>.csv with a status per firm — confident / review / unmatched —
                and whether the phone is a mobile (SMS-capable) or a landline.
  5. Import:    ONLY with --import: confident + mobile firms go to OutreachContact (source=scrape,
                consentState left as 'none'). Nothing is imported by default.

IMPORTANT — scraping 99acres and Housing.com breaches their terms of use, and the Google Maps
Actor carries the same posture as get_pg_coworking_leads_apify.py. The numbers found are business
numbers but NOT opted in: keep the STOP handling and the staged send described in the plan.

Run (pilot, no import):
  python get_agent_leads_from_portals_apify.py --cities Bengaluru --max-firms 50
"""

import argparse
import csv
import difflib
import os
import re
import sys
from collections import Counter
from datetime import datetime, timedelta, timezone

import requests

from get_pg_coworking_leads import import_contacts, lookup_city, mint_admin_jwt
from get_pg_coworking_leads_apify import (
    APIFY_API_BASE,
    DEFAULT_ACTOR_TIMEOUT_SECONDS,
    RequestCounter,
    apify_search,
)

ACRES_ACTOR = "fatihtahta~99acres-scraper-ppe"
HOUSING_ACTOR = "sian.agency~housing-com-property-scraper"
IMPORT_BATCH_SIZE = 20

# The portals and Bhavano disagree on city names; the portals take the common name.
PORTAL_CITY_NAMES = {"Bengaluru": "Bangalore", "Chennai": "Chennai", "Hyderabad": "Hyderabad", "Coimbatore": "Coimbatore"}
CANONICAL_CITY = {"bangalore": "Bengaluru", "bengaluru": "Bengaluru"}

# Words that appear in nearly every agency name and say nothing about which one it is.
NAME_STOPWORDS = {
    "real", "estate", "realty", "realtors", "realtor", "properties", "property", "pvt", "private",
    "ltd", "limited", "llp", "and", "associates", "consultants", "consultancy", "services",
    "solutions", "group", "india", "the", "agency", "agents", "homes", "infra", "developers",
    "enterprises", "co", "company", "brokers", "broker", "pvt.", "ltd.",
}

# Developer-affiliated resale/rental arms and placeholder names that top the portals' listing
# counts but are not independent agents. Substring match on the lowercased firm name. Found by
# reading the 2026-10-14 Bengaluru/Chennai/Hyderabad/Coimbatore list; extend with --exclude.
DEFAULT_EXCLUDE = ("casagrand", "sellassure", "azuro", "ivy homes", "individual agent", "prestige estates")

CONFIDENT_SCORE = 0.85
# The most a name-only match on a single distinctive word can score: just under "confident".
WEAK_NAME_CAP = CONFIDENT_SCORE - 0.01
REVIEW_SCORE = 0.60


def canonical_city(name):
    """99acres reports regions ("Bangalore East", "Chennai South"), Housing.com the city itself.
    Without folding them in, one city splits into several and the same firm never merges across
    portals. Matched on the leading word, so only the four target cities are folded."""
    text = (name or "").strip()
    first = text.lower().split(" ")[0] if text else ""
    for known in ("bengaluru", "bangalore", "chennai", "hyderabad", "coimbatore"):
        if first == known:
            return CANONICAL_CITY.get(known, known.title())
    return CANONICAL_CITY.get(text.lower(), text.title())


def firm_tokens(name):
    """Lowercased word tokens of a firm name with the generic agency words removed. If that leaves
    nothing (a firm literally called "Real Estate"), the unfiltered tokens are used instead, so
    two different firms never collapse onto an empty key."""
    tokens = re.findall(r"[a-z0-9]+", (name or "").lower())
    kept = [t for t in tokens if t not in NAME_STOPWORDS]
    return kept or tokens


def firm_key(name):
    return " ".join(firm_tokens(name))


def plain_name(name):
    """Lowercased alphanumeric words with NOTHING removed — for asking whether two names are the
    same name, as opposed to firm_key(), which drops generic words to compare what is distinctive."""
    return " ".join(re.findall(r"[a-z0-9]+", (name or "").lower()))


def name_similarity(a, b):
    """0..1. The better of a character-level ratio and token overlap, so both "Sri Lakshmi Realty"
    vs "Lakshmi Realty & Associates" (token overlap) and small spelling drift (ratio) score well."""
    ka, kb = firm_key(a), firm_key(b)
    if not ka or not kb:
        return 0.0
    ratio = difflib.SequenceMatcher(None, ka, kb).ratio()
    sa, sb = set(ka.split()), set(kb.split())
    overlap = len(sa & sb) / min(len(sa), len(sb))
    # Overlap alone would call "Sri Lakshmi" a perfect match for "Sri Lakshmi Venkateswara Builders";
    # damp it by how much of the larger name is covered.
    coverage = len(sa & sb) / max(len(sa), len(sb))
    return max(ratio, overlap * (0.6 + 0.4 * coverage))


def national_number(raw):
    """Last 10 digits of an Indian number, or None. Handles +91, 91, a leading 0 and punctuation."""
    digits = re.sub(r"\D", "", raw or "")
    if len(digits) >= 12 and digits.startswith("91"):
        digits = digits[2:]
    elif len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    return digits if len(digits) == 10 else None


def phone_kind(raw):
    """'mobile', 'landline' or None. Decided on the RAW number, before national_number() strips a
    leading 0: "080 2345 6789" is a Bengaluru landline, but once its STD 0 is dropped it reads
    "8023456789", which looks like a mobile. Mobiles are dialled without a 0 and start 6-9."""
    number = national_number(raw)
    if not number:
        return None
    digits = re.sub(r"\D", "", raw or "")
    if len(digits) == 11 and digits.startswith("0"):
        return "landline"
    if number[0] not in "6789":
        return "landline"
    # STD code 80 is Bengaluru, so "+91 80 2345 6789" is a landline that looks like a mobile once
    # the 0 is gone. Mobiles are written 5+5 ("80123 45678"); anything starting 80 that isn't is
    # treated as a landline. Wrongly skipping a mobile costs nothing; wrongly texting a landline
    # is a failed, billed send.
    if number.startswith("80") and not re.search(r"\d{5}[\s-]?\d{5}\s*$", raw or ""):
        return "landline"
    return "mobile"


def is_mobile(raw):
    return phone_kind(raw) == "mobile"


def phone_prefix(masked):
    """'98200.....' -> '98200'. None if the portal gave nothing usable."""
    digits = re.match(r"\s*(\+?91)?[\s-]*(\d{4,8})", masked or "")
    return digits.group(2) if digits else None


def is_agent_label(label):
    """Dealer/agent/broker rows only. Owner and builder/developer rows are dropped on purpose."""
    text = (label or "").lower()
    if any(w in text for w in ("owner", "builder", "developer")):
        return False
    return any(w in text for w in ("dealer", "agent", "broker"))


def parse_iso(value):
    try:
        return datetime.fromisoformat((value or "").replace("Z", "+00:00"))
    except ValueError:
        return None


def firm_from_acres(row, cutoff):
    contact = row.get("contact_details") or {}
    company = (contact.get("company_name") or "").strip()
    if not company or not is_agent_label(contact.get("class_label")):
        return None
    listing = row.get("listing") or {}
    posted = parse_iso(listing.get("posted_at") or listing.get("updated_at"))
    if cutoff and posted and posted.tzinfo and posted < cutoff:
        return None
    location = row.get("location") or {}
    return {
        "firm": company,
        "contact": (contact.get("contact_name") or "").strip(),
        "city": canonical_city(location.get("city")),
        "locality": (location.get("locality") or "").strip(),
        "prefix": None,
        "url": listing.get("details_url") or (row.get("entity") or {}).get("url"),
        "portal": "99acres",
    }


def is_housing_agent(label):
    """On Housing.com an agent is typed "Seller" (verified on live Bengaluru rent and resale rows:
    Seller / Owner / Developer). "Owner" and "Developer" are the private and builder rows."""
    text = (label or "").strip().lower()
    return text in ("seller", "agent", "broker", "dealer")


def firm_from_housing(row, cutoff=None):
    firm = (row.get("listerFirm") or row.get("listerName") or "").strip()
    if not firm or not is_housing_agent(row.get("listerType")):
        return None
    posted = parse_iso(row.get("postedDate"))
    if cutoff and posted and posted.tzinfo and posted < cutoff:
        return None
    return {
        "firm": firm,
        "contact": (row.get("listerName") or "").strip(),
        "city": canonical_city(row.get("city")),
        "locality": (row.get("locality") or row.get("sublocality") or "").strip(),
        "prefix": phone_prefix(row.get("listerPhonePartial")),
        "url": row.get("propertyUrl"),
        "portal": "housing",
    }


def is_excluded(firm_name, keywords):
    name = (firm_name or "").lower()
    return any(k.strip().lower() in name for k in keywords if k.strip())


def merge_firms(rows):
    """One record per (city, firm key). `firm` is the most common spelling seen."""
    merged = {}
    for r in rows:
        if not r:
            continue
        key = (r["city"], firm_key(r["firm"]))
        if not key[1]:
            continue
        m = merged.setdefault(key, {
            "city": r["city"], "names": Counter(), "portals": set(), "listings": 0,
            "localities": Counter(), "prefixes": set(), "urls": [], "contacts": set(),
        })
        m["names"][r["firm"]] += 1
        m["portals"].add(r["portal"])
        m["listings"] += 1
        if r["locality"]:
            m["localities"][r["locality"]] += 1
        if r["prefix"]:
            m["prefixes"].add(r["prefix"])
        if r["url"] and len(m["urls"]) < 3:
            m["urls"].append(r["url"])
        if r["contact"]:
            m["contacts"].add(r["contact"])
    firms = []
    for m in merged.values():
        m["firm"] = m["names"].most_common(1)[0][0]
        firms.append(m)
    # Most active firms first, so a --max-firms cap keeps the ones most likely to be real agents.
    return sorted(firms, key=lambda f: -f["listings"])


def score_candidate(firm, place):
    """Returns (score, prefix_matched, note). Phone-prefix agreement is strong evidence (the portal
    printed those digits for this firm); a mismatch is only a small penalty because agents often
    list a mobile on the portal and an office landline on Google Maps."""
    score = name_similarity(firm["firm"], place.get("title") or "")
    address = (place.get("address") or "").lower()
    locality_hit = any(loc.split(",")[0].strip().lower() in address for loc in firm["localities"] if loc)
    if locality_hit:
        score += 0.10
    number = national_number(place.get("phone"))
    prefix_hit = bool(number) and any(number.startswith(p) for p in firm["prefixes"])
    if prefix_hit:
        score += 0.15
    elif number and firm["prefixes"]:
        score -= 0.05
    if place.get("permanentlyClosed"):
        score -= 0.5
    note = "locality match" if locality_hit else ""
    # A name that is one distinctive word once the generic agency words are removed ("Vishal",
    # "Sai Properties", "SMS Properties") matches almost any firm that shares the word: in the
    # first pilot "Vishal" scored a perfect 1.0 against "Vishal Realty". Without the portal's phone
    # prefix agreeing, or the full names being identical, that is not evidence of the same firm, so
    # it can be at most a "review" match. (An exact name like "Helium Homes" stays eligible.)
    full_name_equal = plain_name(firm["firm"]) == plain_name(place.get("title") or "")
    if len(firm_tokens(firm["firm"])) <= 1 and not prefix_hit and not full_name_equal:
        score = min(score, WEAK_NAME_CAP)
        note = (note + "; " if note else "") + "single-word name, needs review"
    return min(score, 1.0), prefix_hit, note


def classify(score):
    if score >= CONFIDENT_SCORE:
        return "confident"
    if score >= REVIEW_SCORE:
        return "review"
    return "unmatched"


def best_match(firm, places):
    best = None
    for place in places:
        score, prefix_hit, note = score_candidate(firm, place)
        if best is None or score > best["score"]:
            best = {"place": place, "score": score, "prefix_hit": prefix_hit, "note": note}
    return best


def run_actor(token, actor_id, body, timeout_sec):
    try:
        resp = requests.post(
            f"{APIFY_API_BASE}/acts/{actor_id}/run-sync-get-dataset-items",
            params={"timeout": timeout_sec},
            headers={"Authorization": f"Bearer {token}"},
            json=body,
            timeout=timeout_sec + 30,
        )
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException as e:
        print(f"  warning: {actor_id} run failed: {e}", file=sys.stderr)
        return []


def collect_portal_rows(token, cities, portals, limit, max_age_days, timeout_sec):
    cutoff = datetime.now(timezone.utc) - timedelta(days=max_age_days) if max_age_days else None
    rows = []
    for city in cities:
        portal_city = PORTAL_CITY_NAMES.get(city, city)
        if "99acres" in portals:
            for deal in ("residential_sale", "residential_rent"):
                print(f"  99acres: {portal_city} / {deal}", file=sys.stderr)
                items = run_actor(token, ACRES_ACTOR, {
                    "location": [portal_city], "deal_type": deal,
                    "seller_type": ["dealer", "featured_dealer"], "limit": limit,
                }, timeout_sec)
                rows.extend(firm_from_acres(i, cutoff) for i in items)
        if "housing" in portals:
            # "buy" is searched as resale: its unfiltered first pages are almost all new-launch
            # builder listings (live Bengaluru sample: 25 of 30 were Developers), not agents.
            for market, refine in (("buy", "resale"), ("rent", "any")):
                print(f"  housing.com: {portal_city} / {market}", file=sys.stderr)
                items = run_actor(token, HOUSING_ACTOR, {
                    "operation": "search", "cities": [portal_city], "market": market,
                    "refine": refine, "maxResults": limit,
                }, timeout_sec)
                rows.extend(firm_from_housing(i, cutoff) for i in items)
    return rows


def format_city_counts(rows, firms):
    """Per city: agent listings kept, distinct firms, and how many of those firms are on both
    portals (the overlap is why firms are far fewer than listings)."""
    listings = Counter(r["city"] for r in rows if r)
    distinct = Counter(f["city"] for f in firms)
    both = Counter(f["city"] for f in firms if len(f["portals"]) > 1)
    lines = [f"{'city':<14}{'listings':>10}{'firms':>8}{'on both':>9}"]
    for city in sorted(listings):
        lines.append(f"{city:<14}{listings[city]:>10}{distinct[city]:>8}{both[city]:>9}")
    lines.append(f"{'total':<14}{sum(listings.values()):>10}{sum(distinct.values()):>8}{sum(both.values()):>9}")
    return "\n".join(lines)


FIRM_FIELDS = ["city", "firm", "portals", "listings", "localities", "phone_prefixes", "contact_names", "portal_urls"]


def write_firms_csv(path, firms):
    """The merged portal firms, before any Google Maps lookup — what --count-only saves so the
    list can be reviewed in a spreadsheet without paying for the matching step."""
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIRM_FIELDS)
        writer.writeheader()
        for firm in firms:
            writer.writerow({
                "city": firm["city"], "firm": firm["firm"], "portals": "+".join(sorted(firm["portals"])),
                "listings": firm["listings"],
                "localities": "; ".join(l for l, _ in firm["localities"].most_common(5)),
                "phone_prefixes": " ".join(sorted(firm["prefixes"])),
                "contact_names": "; ".join(sorted(firm["contacts"])),
                "portal_urls": " ".join(firm["urls"]),
            })


CSV_FIELDS = [
    "city", "firm", "status", "score", "sms_capable", "phone", "mobile", "prefix_matched", "portals",
    "listings", "localities", "gmaps_name", "gmaps_address", "website", "gmaps_place_id", "portal_urls",
]


def result_row(firm, match):
    row = {
        "city": firm["city"], "firm": firm["firm"], "portals": "+".join(sorted(firm["portals"])),
        "listings": firm["listings"], "localities": "; ".join(l for l, _ in firm["localities"].most_common(3)),
        "portal_urls": " ".join(firm["urls"]),
        "status": "unmatched", "score": "", "sms_capable": "no", "phone": "", "mobile": "",
        "prefix_matched": "", "gmaps_name": "", "gmaps_address": "", "website": "", "gmaps_place_id": "",
    }
    if not match:
        return row
    place = match["place"]
    kind = phone_kind(place.get("phone"))
    row.update({
        "status": classify(match["score"]), "score": round(match["score"], 2),
        "phone": place.get("phone") or "", "mobile": "yes" if kind == "mobile" else (kind or ""),
        "prefix_matched": "yes" if match["prefix_hit"] else "",
        "gmaps_name": place.get("title") or "", "gmaps_address": place.get("address") or "",
        "website": place.get("website") or "", "gmaps_place_id": place.get("placeId") or "",
    })
    row["sms_capable"] = "yes" if row["status"] == "confident" and row["mobile"] == "yes" else "no"
    return row


def build_import_contact(firm, match, city_id, run_ref):
    place = match["place"]
    loc = place.get("location") or {}
    number = national_number(place.get("phone"))
    return {
        "name": (place.get("title") or firm["firm"]).strip(),
        "phone": number,
        "address": place.get("address") or None,
        "lat": loc.get("lat"), "lng": loc.get("lng"),
        "cityId": city_id,
        "googlePlaceId": place.get("placeId") or None,
        "businessCategory": "real_estate_agent",
        "website": place.get("website") or None,
        "tags": ["portal-agent"] + sorted(firm["portals"]),
        "sourceRef": run_ref,
        "notes": (
            f"Advertises on {', '.join(sorted(firm['portals']))} ({firm['listings']} listings seen). "
            f"Portal name: {firm['firm']}. Google Maps match score {match['score']:.2f}. "
            f"Portal listings: {' '.join(firm['urls'])}"
        ),
    }


def import_batched(bff_url, token, contacts):
    totals = {"created": 0, "updated": 0, "skipped": 0}
    for i in range(0, len(contacts), IMPORT_BATCH_SIZE):
        result = import_contacts_scrape(bff_url, token, contacts[i : i + IMPORT_BATCH_SIZE])
        for k in totals:
            totals[k] += result.get(k, 0)
    return totals


def import_contacts_scrape(bff_url, token, contacts):
    """get_pg_coworking_leads.import_contacts() hard-codes source=google_maps; these contacts came
    via portal discovery, so they are imported as `scrape` to keep the provenance honest."""
    resp = requests.post(
        f"{bff_url}/admin/outreach/contacts/import",
        json={"source": "scrape", "contacts": contacts},
        headers={"Authorization": f"Bearer {token}"},
        timeout=60,
    )
    resp.raise_for_status()
    return resp.json()


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--cities", default="Bengaluru", help="Comma-separated, e.g. 'Bengaluru,Chennai,Hyderabad,Coimbatore'")
    parser.add_argument("--portals", default="99acres,housing", help="99acres, housing, or both")
    parser.add_argument("--limit", type=int, default=100, help="Listings per portal query (default 100)")
    parser.add_argument("--max-age-days", type=int, default=30, help="99acres only: ignore listings older than this (0 = no limit). Applies to Housing.com's postedDate as well.")
    parser.add_argument("--max-firms", type=int, default=50, help="Cap Google Maps lookups (one paid Actor run each). Default 50, for a pilot.")
    parser.add_argument("--out-dir", default="./leads_output/portal_agents")
    parser.add_argument("--apify-token", default=os.environ.get("APIFY_API_TOKEN"))
    parser.add_argument("--actor-timeout", type=int, default=DEFAULT_ACTOR_TIMEOUT_SECONDS)
    parser.add_argument("--bff-url", default="http://localhost:4000")
    parser.add_argument("--exclude", default=",".join(DEFAULT_EXCLUDE),
                        help="Comma-separated, case-insensitive name fragments to drop (developer-affiliated "
                        "arms, placeholder names). Default: " + ", ".join(DEFAULT_EXCLUDE) + ". Pass '' for none.")
    parser.add_argument("--count-only", action="store_true",
                        help="Stop after the portal step and print agent listings and distinct firms per city. "
                        "No Google Maps lookups, so it costs only the two portal Actors.")
    parser.add_argument("--import", dest="do_import", action="store_true",
                        help="Import confident, SMS-capable firms into OutreachContact. Off by default.")
    args = parser.parse_args()

    if not args.apify_token:
        raise SystemExit("Apify API token not found — pass --apify-token or set APIFY_API_TOKEN in .env")
    cities = [c.strip() for c in args.cities.split(",") if c.strip()]
    portals = {p.strip() for p in args.portals.split(",") if p.strip()}

    print("Collecting portal listings...", file=sys.stderr)
    rows = collect_portal_rows(args.apify_token, cities, portals, args.limit, args.max_age_days, args.actor_timeout)
    exclude = [k for k in args.exclude.split(",") if k.strip()]
    firms = [f for f in merge_firms(rows) if not is_excluded(f["firm"], exclude)]
    print(f"{len([r for r in rows if r])} agent listings -> {len(firms)} distinct firms", file=sys.stderr)
    if args.count_only:
        print(format_city_counts(rows, firms), file=sys.stderr)
        firms_path = os.path.join(args.out_dir, f"portal_firms_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv")
        write_firms_csv(firms_path, firms)
        print(f"\nWrote {firms_path}", file=sys.stderr)
        return
    firms = firms[: args.max_firms]

    counter = RequestCounter()
    results, matches = [], {}
    for i, firm in enumerate(firms, 1):
        query = f"{firm['firm']} real estate"
        print(f"[{i}/{len(firms)}] {firm['firm']} ({firm['city']})", file=sys.stderr)
        places = apify_search(args.apify_token, "compass~crawler-google-places", query,
                              f"{firm['city']}, India", 3, args.actor_timeout, counter)
        match = best_match(firm, places)
        matches[(firm["city"], firm_key(firm["firm"]))] = match
        results.append(result_row(firm, match))

    run_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    os.makedirs(args.out_dir, exist_ok=True)
    out_path = os.path.join(args.out_dir, f"firms_{run_id}.csv")
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        writer.writeheader()
        writer.writerows(results)

    by_status = Counter(r["status"] for r in results)
    sms = sum(1 for r in results if r["sms_capable"] == "yes")
    print(f"\nWrote {out_path}", file=sys.stderr)
    print(f"Firms: {len(results)} | confident {by_status['confident']} | review {by_status['review']} | "
          f"unmatched {by_status['unmatched']} | SMS-capable (confident + mobile): {sms}", file=sys.stderr)
    print(counter.summary(), file=sys.stderr)

    if not args.do_import:
        print("\nNo --import: nothing was written to Bhavano. Review the CSV first.", file=sys.stderr)
        return

    jwt_secret = os.environ.get("AUTH_JWT_SECRET")
    if not jwt_secret:
        raise SystemExit("AUTH_JWT_SECRET not found — check apps/bff/.env")
    token = mint_admin_jwt(jwt_secret, sub="get_agent_leads_from_portals_apify")
    city_ids = {}
    contacts, seen_phones = [], set()
    for firm in firms:
        match = matches.get((firm["city"], firm_key(firm["firm"])))
        if not match or classify(match["score"]) != "confident":
            continue
        number = national_number(match["place"].get("phone"))
        if not is_mobile(match["place"].get("phone")) or number in seen_phones:
            continue
        seen_phones.add(number)
        if firm["city"] not in city_ids:
            city = lookup_city(args.bff_url, firm["city"])
            city_ids[firm["city"]] = city["id"] if city else None
        contacts.append(build_import_contact(firm, match, city_ids[firm["city"]], f"portals-apify-{run_id}"))
    totals = import_batched(args.bff_url, token, contacts)
    print(f"Imported {len(contacts)} contacts — {totals}. consentState stays 'none'.", file=sys.stderr)


if __name__ == "__main__":
    main()
