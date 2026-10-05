"""Applies the keyword proposals in docs/plans/google-ads-keyword-audit-2026-10.md.

Poster campaigns only; bidding is untouched. All idempotent: keywords already present in the
target ad group are not re-added, already-paused ones are skipped, existing negatives are skipped.

  1. Rent Out 2.2 PG: pause the seeker keywords, add PG-owner keywords.
  2. Lease 3.1 Commercial: pause "lease office space", add owner phrasing.
  3. Lease 3.2 Residential: add owner phrasing. "lease house online" stays enabled until the new
     keywords have a week of data.
  4. "near me" phrase negative on the Rent Out campaigns and Other-Metro Lease.
  5. Exact seeker negatives on the Sell and Rent Out campaigns.
  6. Generic: pause the coworking keywords.
  7. Dormant Sell Villa / Sell Commercial / Rent Out Villa: broader owner keywords.

Pause, never remove — reversible and keeps history.

Run: python ads_apply_keyword_audit.py --dry-run   (validate_only: Google checks, nothing changes)
     python ads_apply_keyword_audit.py
"""

import sys

from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException
from google.api_core import protobuf_helpers

CID = "4214066478"
DRY = "--dry-run" in sys.argv

METRO_AND_OTHER = lambda name: ["Metro-" + name, "Other-Metro-" + name]  # noqa: E731
RENT_OUT = METRO_AND_OTHER("Rent Out Property (Owners)")
LEASE = METRO_AND_OTHER("Lease Property")
SELL = METRO_AND_OTHER("Sell Property (Owners/Agents)")
GENERIC = METRO_AND_OTHER("Generic Post Ad Intent")

# (campaigns, ad group name prefix, keywords to pause, phrase keywords to add)
AD_GROUP_CHANGES = [
    (RENT_OUT, "Ad Group 2.2", ["coliving pg", "colive pgs"],
     ["list my pg", "advertise pg for free", "list pg online", "get tenants for my pg",
      "post pg ad", "pg owner app"]),
    (["Other-Metro-Lease Property"], "Ad Group 3.1", ["lease office space"], []),
    (LEASE, "Ad Group 3.1", [],
     ["lease my office space", "list office space for lease", "give my shop on lease"]),
    (LEASE, "Ad Group 3.2", [],
     ["lease out my house", "give house on lease", "post house for lease", "lease my flat"]),
    (GENERIC, "Ad group 1", ["coworking space", "coworking rental"], []),
    (SELL, "Ad Group 1.3", [], ["sell my villa", "sell independent house"]),
    (SELL, "Ad Group 1.5", [], ["sell my shop", "sell office space"]),
    (RENT_OUT, "Ad Group 2.3", [], ["rent out my independent house"]),
]

# (campaigns, [(text, match type)])
CAMPAIGN_NEGATIVES = [
    (RENT_OUT + ["Other-Metro-Lease Property"], [("near me", "PHRASE")]),
    (SELL, [(t, "EXACT") for t in [
        "property for sale in bangalore by owners", "plot for sale", "property buy",
        "free house searching app"]]),
    (RENT_OUT, [(t, "EXACT") for t in [
        "good house renting apps", "best rental sites in hyderabad", "house rent app",
        "shop on rent jaipur", "commercial warehouse for rent", "warehouse in pune for rent"]]),
]


def main():
    client = make_client()
    ga = client.get_service("GoogleAdsService")
    agc_svc = client.get_service("AdGroupCriterionService")
    cc_svc = client.get_service("CampaignCriterionService")
    enums = client.enums

    def rows(query):
        return list(ga.search(customer_id=CID, query=query))

    def act(label, fn):
        try:
            fn()
            print("  %s %s" % ("valid " if DRY else "done  ", label))
        except GoogleAdsException as e:
            msgs = "; ".join(err.message for err in e.failure.errors) or str(e)
            print("  FAILED %s -> %s" % (label, msgs))
        except Exception as e:
            print("  FAILED %s -> %s: %s" % (label, type(e).__name__, e))

    print("Account %s%s\n" % (CID, "   [DRY RUN - validate_only]" if DRY else ""))

    ad_groups = {}  # (campaign, ad group prefix) -> ad group resource name
    ag_rows = rows("SELECT campaign.name, ad_group.name, ad_group.resource_name FROM ad_group "
                   "WHERE campaign.status = 'ENABLED' AND ad_group.status = 'ENABLED'")
    keywords = {}  # ad group resource -> {text.lower(): (criterion resource, status)}
    for r in rows("SELECT ad_group.resource_name, ad_group_criterion.resource_name, "
                  "ad_group_criterion.keyword.text, ad_group_criterion.status FROM ad_group_criterion "
                  "WHERE ad_group_criterion.type = 'KEYWORD' AND ad_group_criterion.negative = FALSE "
                  "AND ad_group_criterion.status != 'REMOVED' AND campaign.status = 'ENABLED'"):
        keywords.setdefault(r.ad_group.resource_name, {})[r.ad_group_criterion.keyword.text.lower()] = (
            r.ad_group_criterion.resource_name, r.ad_group_criterion.status.name)

    print("Ad group keywords")
    for campaigns, prefix, pause, add in AD_GROUP_CHANGES:
        for cname in campaigns:
            match = [r for r in ag_rows if r.campaign.name == cname and r.ad_group.name.startswith(prefix)]
            if len(match) != 1:
                print("  SKIP   %s / %s* -> %d ad groups match" % (cname, prefix, len(match)))
                continue
            ag = match[0].ad_group.resource_name
            label = "%s / %s" % (cname, match[0].ad_group.name)
            have = keywords.get(ag, {})

            to_pause = [(t, have[t][0]) for t in pause if t in have and have[t][1] == "ENABLED"]
            if to_pause:
                def do_pause(items=to_pause):
                    ops = []
                    for _, rn in items:
                        op = client.get_type("AdGroupCriterionOperation")
                        op.update.resource_name = rn
                        op.update.status = enums.AdGroupCriterionStatusEnum.PAUSED
                        client.copy_from(op.update_mask, protobuf_helpers.field_mask(None, op.update._pb))
                        ops.append(op)
                    agc_svc.mutate_ad_group_criteria(
                        request={"customer_id": CID, "operations": ops, "validate_only": DRY})
                act("%s: pause %s" % (label, ", ".join(t for t, _ in to_pause)), do_pause)
            for t in pause:
                if t not in have:
                    print("  note   %s: '%s' not found" % (label, t))

            to_add = [t for t in add if t.lower() not in have]
            if to_add:
                def do_add(items=to_add, ag=ag):
                    ops = []
                    for text in items:
                        op = client.get_type("AdGroupCriterionOperation")
                        op.create.ad_group = ag
                        op.create.status = enums.AdGroupCriterionStatusEnum.ENABLED
                        op.create.keyword.text = text
                        op.create.keyword.match_type = enums.KeywordMatchTypeEnum.PHRASE
                        ops.append(op)
                    agc_svc.mutate_ad_group_criteria(
                        request={"customer_id": CID, "operations": ops, "validate_only": DRY})
                act("%s: add %s" % (label, ", ".join(to_add)), do_add)

    print("\nCampaign negatives")
    camps = {r.campaign.name: r.campaign.resource_name
             for r in rows("SELECT campaign.name, campaign.resource_name FROM campaign "
                           "WHERE campaign.status = 'ENABLED'")}
    existing = {}
    for r in rows("SELECT campaign.name, campaign_criterion.keyword.text, "
                  "campaign_criterion.keyword.match_type FROM campaign_criterion "
                  "WHERE campaign_criterion.type = 'KEYWORD' AND campaign_criterion.negative = TRUE"):
        existing.setdefault(r.campaign.name, set()).add(
            (r.campaign_criterion.keyword.text.lower(), r.campaign_criterion.keyword.match_type.name))

    for campaigns, negs in CAMPAIGN_NEGATIVES:
        for cname in campaigns:
            if cname not in camps:
                print("  SKIP   %s not found / not enabled" % cname)
                continue
            todo = [(t, m) for t, m in negs if (t, m) not in existing.get(cname, set())]
            if not todo:
                print("  ok     %s already has them" % cname)
                continue

            def do_neg(cname=cname, items=todo):
                ops = []
                for text, mt in items:
                    op = client.get_type("CampaignCriterionOperation")
                    op.create.campaign = camps[cname]
                    op.create.negative = True
                    op.create.keyword.text = text
                    op.create.keyword.match_type = getattr(enums.KeywordMatchTypeEnum, mt)
                    ops.append(op)
                cc_svc.mutate_campaign_criteria(
                    request={"customer_id": CID, "operations": ops, "validate_only": DRY})
            act("%s: negatives %s" % (cname, ", ".join("%s(%s)" % (t, m[:2]) for t, m in todo)), do_neg)


if __name__ == "__main__":
    main()
