"""Excludes "All Users of bhavano-23f72" (REMARKETING, ~3,400 members - everyone with a
Bhavano account) from every poster/acquisition campaign, so Google stops charging for clicks
from people who already have an account and come back via a second ad click instead of
returning directly.

"All Converters" (people who actually posted an ad) is the more precise list for this, but at
40 members it's below Google's ~1,000-member minimum for Search-network audience targeting -
not usable yet. Revisit once it grows; swap the exclusion to that list then.

Deliberately NOT applied to Metro-Seeker Intent - that campaign targets buyers/renters
browsing listings, where a returning existing-account user searching again is normal, wanted
behavior, not the same "paid twice for one conversion" waste as a poster re-clicking an ad to
post again.

Idempotent: skips any campaign that already excludes this list. Additive only.

Run: python ads_exclude_existing_users.py --dry-run   (validate_only: Google checks, nothing changes)
     python ads_exclude_existing_users.py
"""

import sys

from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException

CID = "4214066478"
DRY = "--dry-run" in sys.argv

# `--list "<name>"` swaps in another user list, e.g. the Customer Match list that
# ads_customer_match_upload.py creates, which covers people the signed-in-Google list misses.
DEFAULT_LIST_NAME = "All Users of bhavano-23f72"
TARGET_LIST_NAME = sys.argv[sys.argv.index("--list") + 1] if "--list" in sys.argv else DEFAULT_LIST_NAME

POSTER_CAMPAIGNS = [
    "Metro-Generic Post Ad Intent",
    "Other-Metro-Generic Post Ad Intent",
    "Metro-Sell Property (Owners/Agents)",
    "Other-Metro-Sell Property (Owners/Agents)",
    "Metro-Rent Out Property (Owners)",
    "Other-Metro-Rent Out Property (Owners)",
    "Metro-Lease Property",
    "Other-Metro-Lease Property",
    "Other-Metro-Lease Property-MaxConv",
    "Leads-Search-1",
]


def main():
    client = make_client()
    ga = client.get_service("GoogleAdsService")
    cc_svc = client.get_service("CampaignCriterionService")

    def rows(query):
        return list(ga.search(customer_id=CID, query=query))

    lists = {r.user_list.name: r.user_list.resource_name
              for r in rows("SELECT user_list.name, user_list.resource_name FROM user_list")}
    if TARGET_LIST_NAME not in lists:
        print("FAILED: user list %r not found" % TARGET_LIST_NAME)
        return
    list_resource = lists[TARGET_LIST_NAME]

    camps = {r.campaign.name: r.campaign.resource_name
              for r in rows("SELECT campaign.name, campaign.resource_name FROM campaign "
                            "WHERE campaign.status = 'ENABLED'")}

    existing = set()
    for r in rows("SELECT campaign.name, campaign_criterion.user_list.user_list "
                  "FROM campaign_criterion WHERE campaign_criterion.type = 'USER_LIST' "
                  "AND campaign_criterion.negative = TRUE"):
        existing.add((r.campaign.name, r.campaign_criterion.user_list.user_list))

    print("%s" % ("[DRY RUN]" if DRY else "[LIVE]"))
    ops = []
    for cname in POSTER_CAMPAIGNS:
        if cname not in camps:
            print("  SKIP   %s not found / not enabled" % cname)
            continue
        if (cname, list_resource) in existing:
            print("  ok     %s already excludes this list" % cname)
            continue
        op = client.get_type("CampaignCriterionOperation")
        op.create.campaign = camps[cname]
        op.create.negative = True
        op.create.user_list.user_list = list_resource
        ops.append(op)
        print("  %s %s: exclude %r" % ("valid " if DRY else "queue ", cname, TARGET_LIST_NAME))

    if not ops:
        return

    try:
        resp = cc_svc.mutate_campaign_criteria(
            request={"customer_id": CID, "operations": ops, "validate_only": DRY})
        if DRY:
            print("\n[DRY RUN] Google validated %d exclude operations - no live change made." % len(ops))
        else:
            print("\nAdded %d exclusion(s)." % len(resp.results))
    except GoogleAdsException as e:
        print("FAILED:")
        for err in e.failure.errors:
            print("  -", err.message)


if __name__ == "__main__":
    main()
