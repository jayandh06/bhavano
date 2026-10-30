"""Pauses (never removes) every enabled keyword that mentions the word "free", across all enabled Google Ads campaigns and ad groups.

Why: requested 2026-10-30 - people searching "free" are the least likely to buy Featured. Pausing keeps history and is reversible.
Each run writes ads_pause_free_keywords_backup.json (the paused keywords' resource names), and --rollback re-enables exactly those.

Matching: the whole word "free" (case-insensitive), so "post free ad" and "free property listing" match, "freelance" and "freehold" do not. Only positive keywords, only
enabled ones in enabled ad groups of enabled campaigns. Negative keywords are never touched.

Run: python ads_pause_free_keywords.py --dry-run    read-only: lists the keywords with their last 30 days, changes nothing
     python ads_pause_free_keywords.py              pauses them and writes the backup
     python ads_pause_free_keywords.py --rollback   re-enables the keywords in the backup
"""

import json
import re
import sys
from pathlib import Path

from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException
from google.api_core import protobuf_helpers

CID = "4214066478"
BACKUP = Path(__file__).with_name("ads_pause_free_keywords_backup.json")
FREE = re.compile(r"\bfree\b", re.IGNORECASE)


def main():
    client = make_client()
    ga = client.get_service("GoogleAdsService")
    svc = client.get_service("AdGroupCriterionService")

    if "--rollback" in sys.argv:
        names = json.loads(BACKUP.read_text(encoding="utf8"))["resource_names"]
        ops = []
        for rn in names:
            op = client.get_type("AdGroupCriterionOperation")
            op.update.resource_name = rn
            op.update.status = client.enums.AdGroupCriterionStatusEnum.ENABLED
            client.copy_from(op.update_mask, protobuf_helpers.field_mask(None, op.update._pb))
            ops.append(op)
        svc.mutate_ad_group_criteria(customer_id=CID, operations=ops)
        print("re-enabled %d keywords" % len(ops))
        return

    keywords = []
    for r in ga.search(
        customer_id=CID,
        query="""
        SELECT campaign.name, ad_group.id, ad_group.name, ad_group_criterion.criterion_id, ad_group_criterion.resource_name,
               ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type
        FROM keyword_view
        WHERE ad_group_criterion.status = 'ENABLED' AND ad_group_criterion.negative = FALSE
          AND ad_group.status = 'ENABLED' AND campaign.status = 'ENABLED'
        """,
    ):
        text = r.ad_group_criterion.keyword.text
        if FREE.search(text):
            keywords.append(
                {
                    "campaign": r.campaign.name,
                    "ad_group": r.ad_group.name,
                    "ad_group_id": str(r.ad_group.id),
                    "criterion_id": str(r.ad_group_criterion.criterion_id),
                    "text": text,
                    "match": r.ad_group_criterion.keyword.match_type.name,
                    "resource_name": r.ad_group_criterion.resource_name,
                }
            )

    stats = {}
    for r in ga.search(
        customer_id=CID,
        query="""
        SELECT ad_group.id, ad_group_criterion.criterion_id, metrics.clicks, metrics.cost_micros, metrics.conversions
        FROM keyword_view WHERE segments.date DURING LAST_30_DAYS
        """,
    ):
        stats[(str(r.ad_group.id), str(r.ad_group_criterion.criterion_id))] = (r.metrics.clicks, r.metrics.cost_micros / 1e6, r.metrics.conversions)

    keywords.sort(key=lambda k: (k["campaign"], k["ad_group"], k["text"]))
    total = [0, 0.0, 0.0]
    print("%-38s %-34s %-44s %-7s %6s %8s %6s" % ("campaign", "ad group", "keyword", "match", "clicks", "cost Rs", "conv"))
    for k in keywords:
        clicks, cost, conv = stats.get((k["ad_group_id"], k["criterion_id"]), (0, 0.0, 0.0))
        total[0] += clicks
        total[1] += cost
        total[2] += conv
        print("%-38s %-34s %-44s %-7s %6d %8.0f %6.1f" % (k["campaign"][:38], k["ad_group"][:34], k["text"][:44], k["match"][:7], clicks, cost, conv))
    print("\n%d keywords | last 30 days: %d clicks, Rs %.0f, %.1f conversions" % (len(keywords), total[0], total[1], total[2]))

    if "--dry-run" in sys.argv or not keywords:
        return

    BACKUP.write_text(json.dumps({"resource_names": [k["resource_name"] for k in keywords], "keywords": keywords}, indent=2), encoding="utf8")
    ops = []
    for k in keywords:
        op = client.get_type("AdGroupCriterionOperation")
        op.update.resource_name = k["resource_name"]
        op.update.status = client.enums.AdGroupCriterionStatusEnum.PAUSED
        client.copy_from(op.update_mask, protobuf_helpers.field_mask(None, op.update._pb))
        ops.append(op)
    try:
        svc.mutate_ad_group_criteria(customer_id=CID, operations=ops)
    except GoogleAdsException as e:
        print("mutate failed: %s" % (e.failure.errors[0].message if e.failure.errors else e))
        raise SystemExit(1)
    print("paused %d keywords; backup written to %s" % (len(ops), BACKUP.name))


if __name__ == "__main__":
    main()
