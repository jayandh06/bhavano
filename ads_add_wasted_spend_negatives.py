"""Adds exact-match campaign-level negative keywords for search terms that spent real money
and converted zero times in the 2026-09-28 -> 2026-10-08 window (see the wasted-spend
search-term sweep: ~Rs9,091 total across 254 zero-conversion terms account-wide).

These six are "comparing other sites" / informational browsing, not poster-ready searches -
different problem from the seeker-vs-poster mismatch already fixed (PG, Lease 3.1):
  free property ads posting sites in india   - Rs224, Metro-Sell 1.1
  post property for free                     - Rs154, Metro-Sell 1.1
  property for sale in bangalore by owners   - Rs127, Metro-Sell 1.1
  property listing websites                  - Rs118 (Metro-Sell 1.1) + Rs76 (Other-Metro-Generic)
  plot selling websites                      - Rs101, Metro-Sell 1.4
  online ads for real estate                 - Rs99,  Metro-Sell 1.1

Added at CAMPAIGN level, not per ad group - same convention ads_apply_keyword_audit.py's
proposal #5 already established for this account ("Seeker exact negatives were added at
campaign level... not per ad group").

Idempotent: skips any (campaign, text, match type) pair that's already a negative. Additive
only - never touches existing keywords or ads.

Run: python ads_add_wasted_spend_negatives.py --dry-run   (validate_only: Google checks, nothing changes)
     python ads_add_wasted_spend_negatives.py
"""

import sys

from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException

CID = "4214066478"
DRY = "--dry-run" in sys.argv

# (campaigns, [(keyword text, match type)])
CAMPAIGN_NEGATIVES = [
    (["Metro-Sell Property (Owners/Agents)"], [
        ("free property ads posting sites in india", "EXACT"),
        ("post property for free", "EXACT"),
        ("property for sale in bangalore by owners", "EXACT"),
        ("property listing websites", "EXACT"),
        ("plot selling websites", "EXACT"),
        ("online ads for real estate", "EXACT"),
    ]),
    (["Other-Metro-Generic Post Ad Intent"], [
        ("property listing websites", "EXACT"),
    ]),
]


def main():
    client = make_client()
    ga = client.get_service("GoogleAdsService")
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

    camps = {r.campaign.name: r.campaign.resource_name
             for r in rows("SELECT campaign.name, campaign.resource_name FROM campaign "
                            "WHERE campaign.status = 'ENABLED'")}
    existing = {}
    for r in rows("SELECT campaign.name, campaign_criterion.keyword.text, "
                  "campaign_criterion.keyword.match_type FROM campaign_criterion "
                  "WHERE campaign_criterion.type = 'KEYWORD' AND campaign_criterion.negative = TRUE"):
        existing.setdefault(r.campaign.name, set()).add(
            (r.campaign_criterion.keyword.text.lower(), r.campaign_criterion.keyword.match_type.name))

    print("%s" % ("[DRY RUN]" if DRY else "[LIVE]"))
    for campaigns, negs in CAMPAIGN_NEGATIVES:
        for cname in campaigns:
            if cname not in camps:
                print("  SKIP   %s not found / not enabled" % cname)
                continue
            todo = [(t, m) for t, m in negs if (t.lower(), m) not in existing.get(cname, set())]
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
