"""Adds "rent my house" (phrase match) to Rent Out 2.1 - House/Apartment, in both the Metro
and Other-Metro Rent Out Property (Owners) campaigns.

Why this one and not "rental of property": confirmed via 90 days of real search-term history
that "rent my house" and its close variants (i rent my house, i want to rent my house, rent
my house online, looking for tenant to rent my house) already generate real clicks/spend as
unowned bycatch, scattered across 5 different ad groups (Rent Out 2.1, Rent Out 2.4, Lease 3.1,
Lease 3.2, Generic) - and it follows the owner-action pattern ("verb + my + property") already
proven to convert elsewhere (rent out my flat, lease my house, sell my villa), unlike "rental
of property"/"rental house", which 90 days of data showed is overwhelmingly seeker-intent with
zero conversions across 277 search terms.

Adding it as its own keyword in the one ad group it actually belongs to consolidates that
scattered traffic instead of leaving it as nobody's responsibility - no landing-page or ad-copy
change needed, Rent Out 2.1's existing ad ("my house for rent" etc.) already fits.

Idempotent: skips any ad group that already has this exact text/match type. Additive only -
never touches existing keywords or ads.

Run: python ads_add_rent_my_house.py --dry-run   (validate_only: Google checks, nothing changes)
     python ads_add_rent_my_house.py
"""

import sys

from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException

CID = "4214066478"
DRY = "--dry-run" in sys.argv

TARGET_AD_GROUPS = [
    ("Metro-Rent Out Property (Owners)", "Ad Group 2.1 — Rent Out House/Apartment"),
    ("Other-Metro-Rent Out Property (Owners)", "Ad Group 2.1 — Rent Out House/Apartment"),
]
KEYWORD_TEXT = "rent my house"
MATCH_TYPE = "PHRASE"


def main():
    client = make_client()
    ga = client.get_service("GoogleAdsService")
    agc_svc = client.get_service("AdGroupCriterionService")
    enums = client.enums

    def rows(query):
        return list(ga.search(customer_id=CID, query=query))

    ad_groups = {(r.campaign.name, r.ad_group.name): r.ad_group.resource_name
                 for r in rows("""
        SELECT campaign.name, ad_group.name, ad_group.resource_name
        FROM ad_group WHERE ad_group.status = 'ENABLED' AND campaign.status = 'ENABLED'
    """)}
    existing = {}
    for r in rows("""
        SELECT campaign.name, ad_group.name, ad_group_criterion.keyword.text,
               ad_group_criterion.keyword.match_type
        FROM ad_group_criterion
        WHERE ad_group_criterion.type = 'KEYWORD'
    """):
        key = (r.campaign.name, r.ad_group.name)
        existing.setdefault(key, set()).add(
            (r.ad_group_criterion.keyword.text.lower(), r.ad_group_criterion.keyword.match_type.name))

    print("%s" % ("[DRY RUN]" if DRY else "[LIVE]"))
    ops = []
    for camp, ag in TARGET_AD_GROUPS:
        key = (camp, ag)
        if key not in ad_groups:
            print("  SKIP   %s / %s not found / not enabled" % (camp, ag))
            continue
        if (KEYWORD_TEXT.lower(), MATCH_TYPE) in existing.get(key, set()):
            print("  ok     %s / %s already has it" % (camp, ag))
            continue
        op = client.get_type("AdGroupCriterionOperation")
        op.create.ad_group = ad_groups[key]
        op.create.status = enums.AdGroupCriterionStatusEnum.ENABLED
        op.create.keyword.text = KEYWORD_TEXT
        op.create.keyword.match_type = getattr(enums.KeywordMatchTypeEnum, MATCH_TYPE)
        ops.append(op)
        print("  %s %s / %s: add \"%s\" (%s)" % (
            "valid " if DRY else "queue ", camp, ag, KEYWORD_TEXT, MATCH_TYPE))

    if not ops:
        return

    try:
        resp = agc_svc.mutate_ad_group_criteria(
            request={"customer_id": CID, "operations": ops, "validate_only": DRY})
        if DRY:
            print("\n[DRY RUN] Google validated %d add operations - no live change made." % len(ops))
        else:
            print("\nAdded %d keyword(s)." % len(resp.results))
    except GoogleAdsException as e:
        print("FAILED:")
        for err in e.failure.errors:
            print("  -", err.message)


if __name__ == "__main__":
    main()
