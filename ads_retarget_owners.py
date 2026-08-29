"""Re-points both Ads campaigns from seekers (people looking for property) to posters
(owners/landlords who want to list one).

Every keyword and PMax search theme in the account targeted seeker intent — "rent houses",
"pg in bangalore" — which is the traffic bhavano.com's own SEO already earns for free. Worse,
"Save a search" (a seeker action) was a Primary conversion action, so bidding was actively
optimising toward house-hunters.

Does five things, all idempotent:
  1. Demotes "Save a search" to a secondary conversion action (measured, not bid toward)
  2. Pauses the seeker keywords (pause, not remove — reversible, keeps history)
  3. Adds owner-intent keywords as PHRASE match
  4. Adds seeker-blocking negatives to BOTH campaigns, and copies the competitor negatives
     that were only on the Search campaign across to Performance Max
  5. Repoints landing pages to https://www.bhavano.com/post (was http:// on the homepage)

NOT done here, deliberately — ad copy and PMax assets. New keywords with "find your home"
headlines convert badly, but that copy is a brand judgement, easier to write and preview in
the UI. See the note printed at the end.

Run: python ads_retarget_owners.py --dry-run
     python ads_retarget_owners.py
"""

import sys

from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException

CID = "4214066478"
SEARCH_CAMPAIGN = "Leads-Search-1"
PMAX_CAMPAIGN = "Leads-Performance Max-1"
LANDING_PAGE = "https://www.bhavano.com/post"

# Phrase match throughout: "rent my house" is genuinely ambiguous between an owner and a
# tenant, and broad match drags the tenants straight back in.
OWNER_KEYWORDS = [
    # Rent-out intent. "give ... for rent" and "let out" are the common Indian English forms
    # and are how owners actually phrase this — they are not typos.
    "rent out my house",
    "rent out my flat",
    "give house for rent",
    "give flat for rent",
    "let out my property",
    "list my property for rent",
    "how to rent out my house",
    # Sell intent
    "sell my flat online",
    "list my property for sale",
    "advertise my property",
    # Post/list, brand-agnostic
    "post property ad free",
    "post free property ad",
    "free property listing site",
    "property listing site for owners",
    "post property without broker",
    # PG owners
    "post pg vacancy",
    "list my pg online",
    # Furniture sellers — on this site the seller is the poster
    "sell used furniture online",
]

# Seeker markers. Budget qualifiers and "near me" are the strongest signals that the searcher
# wants to find a property rather than list one.
SEEKER_NEGATIVES_PHRASE = [
    "near me",
    "for rent near me",
    "for sale near me",
    "low budget",
    "for ladies",
    "for gents",
]
SEEKER_NEGATIVES_BROAD = ["cheap", "bachelors"]

# Already negative on Leads-Search-1 but missing from Performance Max.
COMPETITOR_NEGATIVES = ["nobroker", "99acres", "magicbricks", "housing.com", "makaan"]

DRY = "--dry-run" in sys.argv


def main():
    client = make_client()
    ga = client.get_service("GoogleAdsService")

    def rows(query):
        return list(ga.search(customer_id=CID, query=query))

    def act(label, fn):
        if DRY:
            print("  WOULD  %s" % label)
            return
        try:
            fn()
            print("  done   %s" % label)
        except GoogleAdsException as e:
            msg = e.failure.errors[0].message if e.failure.errors else str(e)
            print("  FAILED %s -> %s" % (label, msg))

    print("Account %s%s\n" % (CID, "   [DRY RUN]" if DRY else ""))

    # --- 1. Conversion action: Save a search -> secondary ---------------------------------
    print("Conversion actions")
    for r in rows(
        "SELECT conversion_action.resource_name, conversion_action.name, "
        "conversion_action.primary_for_goal FROM conversion_action "
        "WHERE conversion_action.name = 'Save a search'"
    ):
        if not r.conversion_action.primary_for_goal:
            print("  ok     'Save a search' is already secondary")
            continue

        def demote(rn=r.conversion_action.resource_name):
            svc = client.get_service("ConversionActionService")
            op = client.get_type("ConversionActionOperation")
            op.update.resource_name = rn
            op.update.primary_for_goal = False
            client.copy_from(op.update_mask, client.get_type("FieldMask")(paths=["primary_for_goal"]))
            svc.mutate_conversion_actions(customer_id=CID, operations=[op])

        act("demote 'Save a search' to secondary (seeker action - stop bidding toward it)", demote)

    # --- 2 & 3. Search keywords -----------------------------------------------------------
    print("\nSearch keywords")
    kws = rows(
        "SELECT ad_group_criterion.resource_name, ad_group_criterion.keyword.text, "
        "ad_group_criterion.status, ad_group.resource_name, campaign.name "
        "FROM keyword_view WHERE campaign.name = '%s' "
        "AND ad_group_criterion.status != 'REMOVED'" % SEARCH_CAMPAIGN
    )
    if not kws:
        print("  no keywords found on %s" % SEARCH_CAMPAIGN)
        return
    ad_group = kws[0].ad_group.resource_name
    have = {r.ad_group_criterion.keyword.text.lower() for r in kws}
    keep = {k.lower() for k in OWNER_KEYWORDS}

    to_pause = [
        r
        for r in kws
        if r.ad_group_criterion.keyword.text.lower() not in keep
        and r.ad_group_criterion.status.name == "ENABLED"
    ]
    new_kws = [k for k in OWNER_KEYWORDS if k.lower() not in have]
    print("  %d seeker keywords to pause, %d owner keywords to add" % (len(to_pause), len(new_kws)))

    if to_pause:

        def pause():
            svc = client.get_service("AdGroupCriterionService")
            ops = []
            for r in to_pause:
                op = client.get_type("AdGroupCriterionOperation")
                op.update.resource_name = r.ad_group_criterion.resource_name
                op.update.status = client.enums.AdGroupCriterionStatusEnum.PAUSED
                client.copy_from(op.update_mask, client.get_type("FieldMask")(paths=["status"]))
                ops.append(op)
            svc.mutate_ad_group_criteria(customer_id=CID, operations=ops)

        act("pause %d seeker keywords" % len(to_pause), pause)

    if new_kws:

        def add():
            svc = client.get_service("AdGroupCriterionService")
            ops = []
            for text in new_kws:
                op = client.get_type("AdGroupCriterionOperation")
                c = op.create
                c.ad_group = ad_group
                c.status = client.enums.AdGroupCriterionStatusEnum.ENABLED
                c.keyword.text = text
                c.keyword.match_type = client.enums.KeywordMatchTypeEnum.PHRASE
                ops.append(op)
            svc.mutate_ad_group_criteria(customer_id=CID, operations=ops)

        act("add %d owner-intent keywords (phrase match)" % len(new_kws), add)

    # --- 4. Negatives on both campaigns ---------------------------------------------------
    print("\nNegative keywords")
    camps = {
        r.campaign.name: r.campaign.resource_name
        for r in rows("SELECT campaign.name, campaign.resource_name FROM campaign")
    }
    existing = {}
    for r in rows(
        "SELECT campaign.name, campaign_criterion.keyword.text FROM campaign_criterion "
        "WHERE campaign_criterion.type = 'KEYWORD'"
    ):
        existing.setdefault(r.campaign.name, set()).add(r.campaign_criterion.keyword.text.lower())

    for cname in (SEARCH_CAMPAIGN, PMAX_CAMPAIGN):
        if cname not in camps:
            continue
        have_neg = existing.get(cname, set())
        wanted = (
            [(t, "PHRASE") for t in SEEKER_NEGATIVES_PHRASE]
            + [(t, "BROAD") for t in SEEKER_NEGATIVES_BROAD]
            + [(t, "BROAD") for t in COMPETITOR_NEGATIVES]
        )
        todo = [(t, m) for t, m in wanted if t.lower() not in have_neg]
        if not todo:
            print("  ok     %s already has all of them" % cname)
            continue

        def add_neg(cn=cname, items=todo):
            svc = client.get_service("CampaignCriterionService")
            ops = []
            for text, match in items:
                op = client.get_type("CampaignCriterionOperation")
                c = op.create
                c.campaign = camps[cn]
                c.negative = True
                c.keyword.text = text
                c.keyword.match_type = getattr(client.enums.KeywordMatchTypeEnum, match)
                ops.append(op)
            svc.mutate_campaign_criteria(customer_id=CID, operations=ops)

        act("add %d negatives to %s: %s" % (len(todo), cname, ", ".join(t for t, _ in todo)), add_neg)

    # --- 5. Landing pages -----------------------------------------------------------------
    print("\nLanding pages")
    for r in rows(
        "SELECT ad_group_ad.ad.resource_name, ad_group_ad.ad.final_urls, ad_group.name "
        "FROM ad_group_ad WHERE ad_group_ad.status != 'REMOVED'"
    ):
        if list(r.ad_group_ad.ad.final_urls) == [LANDING_PAGE]:
            print("  ok     search ad already -> %s" % LANDING_PAGE)
            continue

        def fix_ad(rn=r.ad_group_ad.ad.resource_name):
            svc = client.get_service("AdService")
            op = client.get_type("AdOperation")
            op.update.resource_name = rn
            op.update.final_urls.append(LANDING_PAGE)
            client.copy_from(op.update_mask, client.get_type("FieldMask")(paths=["final_urls"]))
            svc.mutate_ads(customer_id=CID, operations=[op])

        act("search ad %s -> %s" % (list(r.ad_group_ad.ad.final_urls), LANDING_PAGE), fix_ad)

    for r in rows("SELECT asset_group.resource_name, asset_group.final_urls, asset_group.name FROM asset_group"):
        if list(r.asset_group.final_urls) == [LANDING_PAGE]:
            print("  ok     asset group already -> %s" % LANDING_PAGE)
            continue

        def fix_ag(rn=r.asset_group.resource_name):
            svc = client.get_service("AssetGroupService")
            op = client.get_type("AssetGroupOperation")
            op.update.resource_name = rn
            op.update.final_urls.append(LANDING_PAGE)
            client.copy_from(op.update_mask, client.get_type("FieldMask")(paths=["final_urls"]))
            svc.mutate_asset_groups(customer_id=CID, operations=[op])

        act("asset group %s -> %s" % (list(r.asset_group.final_urls), LANDING_PAGE), fix_ag)

    print("\n%sStill to do by hand in the Ads UI:" % ("[dry run - nothing changed] " if DRY else ""))
    print("  - Ad copy: headlines still sell 'find a home'. They need to say 'List Your")
    print("    Property Free' / 'No Brokerage' / 'Reach Tenants Directly'.")
    print("  - PMax search themes: replacing them on an existing asset group is a UI edit —")
    print("    Asset Group 1 -> Audience signals -> Search themes.")
    print("  - Disable the duplicate 'Sign-up' conversion action (MANY_PER_CLICK, double-counts")
    print("    against 'New registration').")


if __name__ == "__main__":
    main()
