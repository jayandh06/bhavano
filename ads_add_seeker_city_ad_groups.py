"""Adds Rent / Buy ad groups to the Metro-Seeker Intent campaign for the cities that were added to its location
targeting but had no ad group (Hyderabad, Delhi NCR, Chennai, Mumbai), copying the live Bengaluru ad groups.

Why: the campaign targets 8 locations but only had ad groups for Bengaluru, Pune and Kolkata, so searchers in the other
cities had nothing city-specific to match (and the existing ads send everyone to a Bengaluru page).
docs/plans/seeker-intent-campaign.md describes the original build.

What it creates, per city, from the Bengaluru Rent / Buy Seekers template read live from the account (so the wording,
punctuation and structure stay identical): an ad group ("Ad Group — <City> Rent Seekers" / "... Buy Seekers"), its 8
phrase-match keywords (the template's, with the city swapped), and one responsive search ad whose headlines,
descriptions, display path and **final URL** are the city's own (https://www.bhavano.com/<city-slug>/rent-lease or
/buy). Rent groups are ENABLED, Buy groups PAUSED (matching the existing Buy groups). The campaign's Final URL suffix
(click tracking) is inherited. Skips any ad group whose name already exists; checks every headline (30) and
description (90) length before sending anything. Navi Mumbai (also targeted) has no page on the site, so its searchers
are served by the Mumbai pages.

Run: python ads_add_seeker_city_ad_groups.py --dry-run     read-only, prints exactly what would be created
     python ads_add_seeker_city_ad_groups.py --validate    Google validates the whole batch, nothing is created
     python ads_add_seeker_city_ad_groups.py               creates it
"""

import argparse

from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException

CID = "4214066478"
CAMPAIGN_NAME = "Metro-Seeker Intent"
TEMPLATE_CITY = "Bengaluru"
TEMPLATE_GROUPS = {"rent": "Rent Seekers", "buy": "Buy Seekers"}
# display name (ad text), keyword form (what people type), site slug (URL path + display path)
CITIES = [
    ("Hyderabad", "hyderabad", "hyderabad"),
    ("Delhi NCR", "delhi", "delhi-ncr"),
    ("Chennai", "chennai", "chennai"),
    ("Mumbai", "mumbai", "mumbai"),
]
TRANSACTION_PATH = {"rent": "rent-lease", "buy": "buy"}
SITE = "https://www.bhavano.com"
STATUS = {"rent": "ENABLED", "buy": "PAUSED"}


def swap_text(text, display, keyword_form):
    """Template text -> city text. Title-case form for ad copy, lower-case form for keywords."""
    return text.replace(TEMPLATE_CITY, display).replace(TEMPLATE_CITY.lower(), keyword_form)


def main():
    p = argparse.ArgumentParser()
    mode = p.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true")
    mode.add_argument("--validate", action="store_true")
    args = p.parse_args()

    client = make_client()
    ga = client.get_service("GoogleAdsService")

    campaign_resource = None
    for r in ga.search(customer_id=CID, query=f"SELECT campaign.resource_name FROM campaign WHERE campaign.name = '{CAMPAIGN_NAME}'"):
        campaign_resource = r.campaign.resource_name
    if not campaign_resource:
        raise SystemExit("campaign not found")

    existing = {}
    for r in ga.search(customer_id=CID, query=f"""
        SELECT ad_group.id, ad_group.name, ad_group.status FROM ad_group
        WHERE campaign.name = '{CAMPAIGN_NAME}' AND ad_group.status != 'REMOVED'"""):
        existing[r.ad_group.name] = r.ad_group

    # --- templates, read live
    templates = {}
    for key, suffix in TEMPLATE_GROUPS.items():
        group = next((g for n, g in existing.items() if TEMPLATE_CITY in n and n.endswith(suffix)), None)
        if group is None:
            raise SystemExit("template ad group for %s %s not found" % (TEMPLATE_CITY, suffix))
        keywords = [
            (r.ad_group_criterion.keyword.text, r.ad_group_criterion.keyword.match_type)
            for r in ga.search(customer_id=CID, query=f"""
                SELECT ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type
                FROM ad_group_criterion
                WHERE ad_group.id = {group.id} AND ad_group_criterion.type = 'KEYWORD'
                  AND ad_group_criterion.negative = FALSE AND ad_group_criterion.status != 'REMOVED'""")
        ]
        ad = None
        for r in ga.search(customer_id=CID, query=f"""
            SELECT ad_group_ad.ad.responsive_search_ad.headlines, ad_group_ad.ad.responsive_search_ad.descriptions,
                   ad_group_ad.ad.responsive_search_ad.path1, ad_group_ad.ad.responsive_search_ad.path2
            FROM ad_group_ad WHERE ad_group.id = {group.id} AND ad_group_ad.status != 'REMOVED'"""):
            ad = r.ad_group_ad.ad.responsive_search_ad
        if ad is None or not keywords:
            raise SystemExit("template %s has no ad or keywords" % group.name)
        templates[key] = {
            "name": group.name,
            "keywords": keywords,
            "headlines": [h.text for h in ad.headlines],
            "descriptions": [d.text for d in ad.descriptions],
            "path1": ad.path1,
        }

    # --- build the plan, with length checks
    plan = []
    problems = []
    for display, keyword_form, slug in CITIES:
        for key in ("rent", "buy"):
            t = templates[key]
            name = swap_text(t["name"], display, keyword_form)
            if name in existing:
                print("SKIP (already exists):", name.encode("ascii", "replace").decode())
                continue
            headlines = [swap_text(h, display, keyword_form) for h in t["headlines"]]
            descriptions = [swap_text(d, display, keyword_form) for d in t["descriptions"]]
            for h in headlines:
                if len(h) > 30:
                    problems.append("headline too long (%d): %s" % (len(h), h))
            for d in descriptions:
                if len(d) > 90:
                    problems.append("description too long (%d): %s" % (len(d), d))
            if len(slug) > 15:
                problems.append("display path too long: " + slug)
            plan.append({
                "name": name,
                "status": STATUS[key],
                "keywords": [(swap_text(text, display, keyword_form), mt) for text, mt in t["keywords"]],
                "headlines": headlines,
                "descriptions": descriptions,
                "path1": t["path1"],
                "path2": slug,
                "url": f"{SITE}/{slug}/{TRANSACTION_PATH[key]}",
            })
    if problems:
        raise SystemExit("not sending anything:\n  " + "\n  ".join(problems))

    print("ad groups to create: %d" % len(plan))
    for g in plan:
        print("  [%s] %s -> %s  (%d keywords, %d headlines, %d descriptions)" % (
            g["status"], g["name"].encode("ascii", "replace").decode(), g["url"], len(g["keywords"]), len(g["headlines"]), len(g["descriptions"])))
        print("       keywords:", ", ".join(k for k, _ in g["keywords"]))
        print("       headline 1:", g["headlines"][0], "| display path: /%s/%s" % (g["path1"], g["path2"]))
    if args.dry_run or not plan:
        return

    # --- build one batch with temporary ids
    ad_group_service = client.get_service("AdGroupService")
    ops = []
    temp = -1
    for g in plan:
        ag_resource = ad_group_service.ad_group_path(CID, temp)
        temp -= 1

        op = client.get_type("MutateOperation")
        ag = op.ad_group_operation.create
        ag.resource_name = ag_resource
        ag.name = g["name"]
        ag.campaign = campaign_resource
        ag.status = client.enums.AdGroupStatusEnum[g["status"]]
        ag.type_ = client.enums.AdGroupTypeEnum.SEARCH_STANDARD
        ag.cpc_bid_micros = 10000  # same as the existing seeker ad groups (bidding is the portfolio Target CPA)
        ops.append(op)

        for text, match_type in g["keywords"]:
            op = client.get_type("MutateOperation")
            c = op.ad_group_criterion_operation.create
            c.ad_group = ag_resource
            c.status = client.enums.AdGroupCriterionStatusEnum.ENABLED
            c.keyword.text = text
            c.keyword.match_type = match_type
            ops.append(op)

        op = client.get_type("MutateOperation")
        aga = op.ad_group_ad_operation.create
        aga.ad_group = ag_resource
        aga.status = client.enums.AdGroupAdStatusEnum.ENABLED
        aga.ad.final_urls.append(g["url"])
        rsa = aga.ad.responsive_search_ad
        for h in g["headlines"]:
            asset = client.get_type("AdTextAsset")
            asset.text = h
            rsa.headlines.append(asset)
        for d in g["descriptions"]:
            asset = client.get_type("AdTextAsset")
            asset.text = d
            rsa.descriptions.append(asset)
        rsa.path1 = g["path1"]
        rsa.path2 = g["path2"]
        ops.append(op)

    request = client.get_type("MutateGoogleAdsRequest")
    request.customer_id = CID
    request.mutate_operations.extend(ops)
    request.validate_only = args.validate
    try:
        resp = ga.mutate(request=request)
    except GoogleAdsException as e:
        raise SystemExit("mutate failed:\n%s" % "\n".join(
            "  %s (%s)" % (er.message, er.location.field_path_elements[-1].field_name if er.location.field_path_elements else "-")
            for er in e.failure.errors))
    if args.validate:
        print("validated only - nothing created (%d operations)" % len(ops))
    else:
        print("created %d ad groups, %d operations" % (len(plan), len(resp.mutate_operation_responses)))


if __name__ == "__main__":
    main()
