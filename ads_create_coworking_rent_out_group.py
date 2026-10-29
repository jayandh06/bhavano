"""Creates "Ad Group 2.6 - Rent Out Coworking" in Metro-Rent Out Property (Owners), modelled on "Ad Group 2.2 - Rent Out PG".

Why the keywords look like this (docs/plans/google-ads-keyword-audit-2026-10.md, "Coworking ad group, 2026-10-29"): in the PG group the owner-voice pattern "<verb> <product> <plain word>" earns the Quality Score and the traffic
("post pg ad" QS 10 with above-average CTR / ad relevance / landing page; "post pg for rent" 537 impressions; "list my pg" 129). The city variants ("list my pg in mumbai") got no impressions, and "pg owner app" scored only 5
with below-average ad relevance, so neither is copied. Every keyword is PHRASE match, so a seeker's "coworking space for rent" (which does not contain any of these phrases) does not trigger the group.
The ad repeats the keyword words in its headlines (ad relevance) and the landing card for this ad group opens the posting form on the coworking category (landing page experience), see apps/web/src/lib/adLandingCard.ts.
Claims are only what the product does: "No brokerage" and "direct enquiries". No "verified" and no fee promises.

Run: python ads_create_coworking_rent_out_group.py --dry-run     read-only, prints everything it would create
     python ads_create_coworking_rent_out_group.py --validate    Google validates the whole request, nothing is created
     python ads_create_coworking_rent_out_group.py               creates the group (enabled) and saves its id to ads_coworking_group_backup.json
     python ads_create_coworking_rent_out_group.py --rollback    pauses the group created above (nothing is deleted)
"""

import argparse
import json
import os

from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException

CID = "4214066478"
CAMPAIGN = "Metro-Rent Out Property (Owners)"
GROUP_NAME = "Ad Group 2.6 - Rent Out Coworking"
BACKUP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ads_coworking_group_backup.json")

KEYWORDS = [
    "post coworking space ad",
    "post coworking space for rent",
    "list my coworking space",
    "list coworking space online",
    "advertise my coworking space",
    "rent out my coworking space",
    "get members for my coworking space",
    "fill my coworking space",
]

HEADLINES = [
    "Post Coworking Space Ad",
    "List Your Coworking Space",
    "Advertise Your Coworking Space",
    "Rent Out Coworking Desks",
    "Get Members For Your Space",
    "Fill Vacant Coworking Seats",
    "Coworking Owner? Post Your Ad",
    "Coworking Listing In Minutes",
    "Reach Coworking Seekers Nearby",
    "Post Ad, Get Real Inquiries",
    "No Brokerage, Direct Enquiries",
    "Coworking Space? List It Now",
    "Find Coworking Members Fast",
    "Coworking Renting Made Simple",
    "Rent Out Your Coworking Space",
]

DESCRIPTIONS = [
    "List your coworking space on Bhavano and reach people searching for desks nearby.",
    "Post your coworking ad in minutes. No brokerage, just direct enquiries from members.",
    "Coworking owner looking for members? Reach active seekers looking for a workspace today.",
    "List your coworking space, add photos and rates, and get found by serious seekers.",
]

PATH1, PATH2 = "rent", "Coworking"
FINAL_URL = "https://www.bhavano.com"


def check_lengths():
    for h in HEADLINES:
        assert len(h) <= 30, (len(h), h)
    for d in DESCRIPTIONS:
        assert len(d) <= 90, (len(d), d)
    assert len(PATH1) <= 15 and len(PATH2) <= 15


def main():
    ap = argparse.ArgumentParser()
    mode = ap.add_mutually_exclusive_group()
    for m in ("dry-run", "validate", "rollback"):
        mode.add_argument("--" + m, action="store_true")
    args = ap.parse_args()
    check_lengths()
    client = make_client()
    ga = client.get_service("GoogleAdsService")

    camp = next(iter(ga.search(customer_id=CID, query=f"SELECT campaign.resource_name FROM campaign WHERE campaign.name = '{CAMPAIGN}' AND campaign.status = 'ENABLED'")), None)
    if camp is None:
        raise SystemExit("campaign not found or not enabled: " + CAMPAIGN)
    camp_rn = camp.campaign.resource_name

    if args.rollback:
        rn = json.load(open(BACKUP, encoding="utf8"))["ad_group"]
        op = client.get_type("AdGroupOperation")
        op.update.resource_name = rn
        op.update.status = client.enums.AdGroupStatusEnum.PAUSED
        op.update_mask.paths.append("status")
        client.get_service("AdGroupService").mutate_ad_groups(customer_id=CID, operations=[op])
        print("paused " + rn)
        return

    existing = next(iter(ga.search(customer_id=CID, query=f"SELECT ad_group.resource_name FROM ad_group WHERE campaign.name = '{CAMPAIGN}' AND ad_group.name = '{GROUP_NAME}' AND ad_group.status != 'REMOVED'")), None)
    if existing is not None:
        raise SystemExit("already exists: " + existing.ad_group.resource_name)

    print("campaign: %s\nad group: %s (enabled, standard search, bids come from the shared target-CPA strategy)" % (CAMPAIGN, GROUP_NAME))
    print("keywords (PHRASE): " + ", ".join(KEYWORDS))
    print("ad: paths %s/%s, final url %s" % (PATH1, PATH2, FINAL_URL))
    for h in HEADLINES:
        print("   H %-30s (%d)" % (h, len(h)))
    for d in DESCRIPTIONS:
        print("   D %s (%d)" % (d, len(d)))
    if args.dry_run:
        return

    ag_rn = "customers/%s/adGroups/-1" % CID
    ops = []

    op = client.get_type("MutateOperation")
    g = op.ad_group_operation.create
    g.resource_name = ag_rn
    g.name = GROUP_NAME
    g.campaign = camp_rn
    g.status = client.enums.AdGroupStatusEnum.ENABLED
    g.type_ = client.enums.AdGroupTypeEnum.SEARCH_STANDARD
    g.cpc_bid_micros = 10000  # same placeholder as the PG group; the shared target-CPA strategy sets the real bids
    ops.append(op)

    for kw in KEYWORDS:
        op = client.get_type("MutateOperation")
        c = op.ad_group_criterion_operation.create
        c.ad_group = ag_rn
        c.status = client.enums.AdGroupCriterionStatusEnum.ENABLED
        c.keyword.text = kw
        c.keyword.match_type = client.enums.KeywordMatchTypeEnum.PHRASE
        ops.append(op)

    op = client.get_type("MutateOperation")
    a = op.ad_group_ad_operation.create
    a.ad_group = ag_rn
    a.status = client.enums.AdGroupAdStatusEnum.ENABLED
    a.ad.final_urls.append(FINAL_URL)
    rsa = a.ad.responsive_search_ad
    for h in HEADLINES:
        asset = client.get_type("AdTextAsset")
        asset.text = h
        rsa.headlines.append(asset)
    for d in DESCRIPTIONS:
        asset = client.get_type("AdTextAsset")
        asset.text = d
        rsa.descriptions.append(asset)
    rsa.path1, rsa.path2 = PATH1, PATH2
    ops.append(op)

    request = client.get_type("MutateGoogleAdsRequest")
    request.customer_id = CID
    request.mutate_operations.extend(ops)
    request.validate_only = args.validate
    try:
        resp = ga.mutate(request=request)
    except GoogleAdsException as e:
        raise SystemExit("mutate failed:\n%s" % "\n".join("  " + er.message for er in e.failure.errors))
    if args.validate:
        print("validated only - nothing created (%d operations)" % len(ops))
        return
    created = resp.mutate_operation_responses[0].ad_group_result.resource_name
    json.dump({"ad_group": created}, open(BACKUP, "w", encoding="utf8"), indent=2)
    print("created " + created + "  (saved to " + BACKUP + ")")


if __name__ == "__main__":
    main()
