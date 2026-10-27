"""Removes live owner-campaign keywords that contain the word "free" AND had no conversion in the last 30 days.

Why (docs/plans/google-ads-keyword-audit-2026-10.md, "Free keywords, 2026-10-27"): the owner ads deliberately do not say "free" (so it does not prime resistance to the paid Featured
upsell), so keywords that say it score lower on ad relevance. 62 live keywords contain "free"; 23 of them earn conversions (118 of 412 in 30 days, 29%) and stay. The rest earned none,
so they cost relevance and clutter and no conversions.

Never touches: keywords with a conversion in the last 30 days, the 19 keywords added on 2026-10-27 by ads_add_owner_converting_keywords.py (they have no data yet), paused keywords,
seeker campaigns. REMOVES (does not pause); every removed keyword is saved to ads_removed_free_keywords_2026-10-27.json first and --restore re-creates them.

Run: python ads_remove_free_keywords.py --dry-run     read-only, prints exactly what would be removed
     python ads_remove_free_keywords.py --validate    Google validates the batch, nothing changes
     python ads_remove_free_keywords.py               removes them
     python ads_remove_free_keywords.py --restore     re-creates the removed keywords from the backup file
"""

import argparse
import json
import os
import re

from ads_add_owner_converting_keywords import PLAN as RECENT_ADDITIONS
from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException

CID = "4214066478"
BACKUP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ads_removed_free_keywords_2026-10-27.json")
F = "campaign.name REGEXP_MATCH '^(Metro|Other-Metro)-.*' AND campaign.name NOT LIKE '%Seeker%'"
FREE = re.compile(r"\bfree\b", re.I)
PROTECTED = {t.lower() for _, _, kws in RECENT_ADDITIONS for t in kws}


def main():
    ap = argparse.ArgumentParser()
    mode = ap.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true")
    mode.add_argument("--validate", action="store_true")
    mode.add_argument("--restore", action="store_true")
    args = ap.parse_args()

    client = make_client()
    ga = client.get_service("GoogleAdsService")

    if args.restore:
        with open(BACKUP, encoding="utf8") as f:
            data = json.load(f)
        ops = []
        for k in data["removed_keywords"]:
            op = client.get_type("MutateOperation")
            c = op.ad_group_criterion_operation.create
            c.ad_group = k["ad_group_resource"]
            c.status = client.enums.AdGroupCriterionStatusEnum[k["status"]]
            c.keyword.text = k["text"]
            c.keyword.match_type = client.enums.KeywordMatchTypeEnum[k["match_type"]]
            ops.append(op)
        send(client, ga, ops, False)
        return

    kws = {}
    for r in ga.search(customer_id=CID, query=f"""
        SELECT campaign.name, campaign.status, ad_group.name, ad_group.status, ad_group.resource_name, ad_group_criterion.resource_name,
               ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, ad_group_criterion.status,
               ad_group_criterion.quality_info.quality_score, ad_group_criterion.quality_info.creative_quality_score
        FROM ad_group_criterion WHERE {F} AND ad_group_criterion.type = 'KEYWORD' AND ad_group_criterion.negative = FALSE
          AND ad_group_criterion.status = 'ENABLED' AND ad_group.status = 'ENABLED' AND campaign.status = 'ENABLED'"""):
        c = r.ad_group_criterion
        kws[c.resource_name] = dict(campaign=r.campaign.name, ad_group=r.ad_group.name, ad_group_resource=r.ad_group.resource_name,
                                    criterion=c.resource_name, text=c.keyword.text, match_type=c.keyword.match_type.name,
                                    status=c.status.name, qs=c.quality_info.quality_score, rel=c.quality_info.creative_quality_score.name,
                                    clk=0, cost=0.0, conv=0.0)
    for r in ga.search(customer_id=CID, query=f"""
        SELECT ad_group_criterion.resource_name, metrics.clicks, metrics.cost_micros, metrics.conversions FROM keyword_view
        WHERE {F} AND segments.date DURING LAST_30_DAYS"""):
        k = kws.get(r.ad_group_criterion.resource_name)
        if k:
            k["clk"] += r.metrics.clicks
            k["cost"] += r.metrics.cost_micros / 1e6
            k["conv"] += r.metrics.conversions

    free = [k for k in kws.values() if FREE.search(k["text"])]
    keep_earners = [k for k in free if k["conv"] > 0]
    keep_new = [k for k in free if k["conv"] == 0 and k["text"].lower() in PROTECTED]
    remove = [k for k in free if k["conv"] == 0 and k["text"].lower() not in PROTECTED]
    print("live 'free' keywords: %d | keep (earned conversions): %d | keep (added today, no data yet): %d | REMOVE: %d" % (
        len(free), len(keep_earners), len(keep_new), len(remove)))
    print("removing costs 30-day spend of %.0f and 0 conversions; %d of them score below average on ad relevance, %d have a quality score" % (
        sum(k["cost"] for k in remove), sum(1 for k in remove if k["rel"] == "BELOW_AVERAGE"), sum(1 for k in remove if k["qs"])))
    for k in sorted(remove, key=lambda x: (x["campaign"], -x["cost"])):
        print("  %-34s %-26s %-44s QS%-3s %-13s clk %2d cost %4.0f" % (
            k["campaign"][:34], k["ad_group"].encode("ascii", "replace").decode()[:26], k["text"][:44], k["qs"] or "-", k["rel"][:13], k["clk"], k["cost"]))
    if args.dry_run:
        return

    if not args.validate:
        with open(BACKUP, "w", encoding="utf8") as f:
            json.dump({"removed_keywords": [{x: k[x] for x in ("campaign", "ad_group", "ad_group_resource", "text", "match_type", "status")} for k in remove]},
                      f, indent=1, ensure_ascii=False)
        print("\nbackup written: %s" % BACKUP)
    ops = []
    for k in remove:
        op = client.get_type("MutateOperation")
        op.ad_group_criterion_operation.remove = k["criterion"]
        ops.append(op)
    send(client, ga, ops, args.validate)


def send(client, ga, ops, validate):
    if not ops:
        print("nothing to do")
        return
    request = client.get_type("MutateGoogleAdsRequest")
    request.customer_id = CID
    request.mutate_operations.extend(ops)
    request.validate_only = validate
    try:
        ga.mutate(request=request)
    except GoogleAdsException as e:
        raise SystemExit("mutate failed:\n%s" % "\n".join("  " + er.message for er in e.failure.errors))
    print("validated only - nothing changed (%d operations)" % len(ops) if validate else "done: %d operations" % len(ops))


if __name__ == "__main__":
    main()
