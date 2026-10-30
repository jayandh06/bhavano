"""Adds campaign-level negative keywords so searches asking for something free no longer trigger the enabled owner campaigns.

Why (2026-10-30): the "free" keywords were paused, but the remaining phrase-match keywords ("post property ad", "list my flat") still match
queries like "post property ad free". Broad negative "free" blocks any query containing the word; the phrases cover "no cost" and "without paying".
Idempotent: skips pairs that already exist. Additive only.

Run: python ads_add_free_negatives.py --dry-run
     python ads_add_free_negatives.py
"""

import sys

from ads_setup_conversions import make_client

CID = "4214066478"
DRY = "--dry-run" in sys.argv
NEGATIVES = [("free", "BROAD"), ("no cost", "PHRASE"), ("without paying", "PHRASE")]


def main():
    client = make_client()
    ga = client.get_service("GoogleAdsService")
    svc = client.get_service("CampaignCriterionService")

    camps = {
        r.campaign.name: r.campaign.resource_name
        for r in ga.search(customer_id=CID, query="SELECT campaign.name, campaign.resource_name FROM campaign WHERE campaign.status = 'ENABLED'")
    }
    existing = set()
    for r in ga.search(
        customer_id=CID,
        query="SELECT campaign.name, campaign_criterion.keyword.text, campaign_criterion.keyword.match_type FROM campaign_criterion "
        "WHERE campaign_criterion.type = 'KEYWORD' AND campaign_criterion.negative = TRUE",
    ):
        existing.add((r.campaign.name, r.campaign_criterion.keyword.text.lower(), r.campaign_criterion.keyword.match_type.name))

    ops = []
    for name, resource in sorted(camps.items()):
        for text, match in NEGATIVES:
            if (name, text, match) in existing:
                continue
            op = client.get_type("CampaignCriterionOperation")
            op.create.campaign = resource
            op.create.negative = True
            op.create.keyword.text = text
            op.create.keyword.match_type = getattr(client.enums.KeywordMatchTypeEnum, match)
            ops.append(op)
            print("%s: %s (%s)" % (name, text, match))
    print("%d negatives%s" % (len(ops), " (validate only)" if DRY else ""))
    if ops:
        svc.mutate_campaign_criteria(request={"customer_id": CID, "operations": ops, "validate_only": DRY})


if __name__ == "__main__":
    main()
