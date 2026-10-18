"""Stops non-brand campaigns paying for people who search for "bhavano" by name.

Someone typing our own name is almost always a returning user (or someone who already saw us), so
every such click on a poster/acquisition campaign is a second payment for a person we already
have. Adds campaign-level PHRASE negatives for the brand word and common misspellings to every
enabled campaign whose name does not contain "brand" (a dedicated brand campaign, if one exists,
is left alone on purpose - it is the cheap, controlled place for those clicks).

Modes, safe by default:
  python ads_add_brand_negatives.py --report     read-only: brand search terms, cost and
                                                 conversions per campaign over the last 30 days
  python ads_add_brand_negatives.py --dry-run    validate_only: Google checks, nothing changes
  python ads_add_brand_negatives.py              live

Idempotent: skips any (campaign, text) pair already present as a negative. Additive only.
See docs/plans/avoid-paid-clicks-from-existing-users.md.
"""

import sys

from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException

CID = "4214066478"
DRY = "--dry-run" in sys.argv
REPORT = "--report" in sys.argv

BRAND_TERMS = ["bhavano", "bhavno", "bavano", "bhawano", "bhavanoo", "bhavan o"]


def main():
    client = make_client()
    ga = client.get_service("GoogleAdsService")
    cc_svc = client.get_service("CampaignCriterionService")
    enums = client.enums

    def rows(query):
        return list(ga.search(customer_id=CID, query=query))

    if REPORT:
        print("Brand-term search terms, last 30 days:\n")
        total = 0.0
        q = ("SELECT campaign.name, search_term_view.search_term, metrics.clicks, "
             "metrics.cost_micros, metrics.conversions FROM search_term_view "
             "WHERE segments.date DURING LAST_30_DAYS AND search_term_view.search_term LIKE '%bhav%' "
             "ORDER BY metrics.cost_micros DESC")
        for r in rows(q):
            cost = r.metrics.cost_micros / 1_000_000
            total += cost
            print("  %-45s %-35s clicks=%-4d cost=%8.2f conv=%.1f" % (
                r.campaign.name, r.search_term_view.search_term, r.metrics.clicks, cost, r.metrics.conversions))
        print("\nTotal spent on brand-term searches: %.2f" % total)
        return

    camps = {r.campaign.name: r.campaign.resource_name
             for r in rows("SELECT campaign.name, campaign.resource_name FROM campaign "
                            "WHERE campaign.status = 'ENABLED'")}
    existing = {}
    for r in rows("SELECT campaign.name, campaign_criterion.keyword.text FROM campaign_criterion "
                  "WHERE campaign_criterion.type = 'KEYWORD' AND campaign_criterion.negative = TRUE"):
        existing.setdefault(r.campaign.name, set()).add(r.campaign_criterion.keyword.text.lower())

    print("%s" % ("[DRY RUN]" if DRY else "[LIVE]"))
    ops = []
    for cname, resource in camps.items():
        if "brand" in cname.lower():
            print("  SKIP   %s (brand campaign)" % cname)
            continue
        for term in BRAND_TERMS:
            if term in existing.get(cname, set()):
                continue
            op = client.get_type("CampaignCriterionOperation")
            op.create.campaign = resource
            op.create.negative = True
            op.create.keyword.text = term
            op.create.keyword.match_type = enums.KeywordMatchTypeEnum.PHRASE
            ops.append(op)
            print("  %s %s: negative phrase %r" % ("valid " if DRY else "queue ", cname, term))

    if not ops:
        print("Nothing to add.")
        return

    try:
        resp = cc_svc.mutate_campaign_criteria(
            request={"customer_id": CID, "operations": ops, "validate_only": DRY})
        if DRY:
            print("\n[DRY RUN] Google validated %d operations - no live change made." % len(ops))
        else:
            print("\nAdded %d negative(s)." % len(resp.results))
    except GoogleAdsException as e:
        print("FAILED:")
        for err in e.failure.errors:
            print("  -", err.message)


if __name__ == "__main__":
    main()
