"""Adds the villa owner phrases from docs/plans/owner-keywords-by-category-and-transaction.md to the two empty "Ad Group 2.3 - Rent Out Villa/Independent House" groups.

Why: Google flags "1 ad group does not have any keywords" (recommendation +11.3%). Both Ad Group 2.3 groups (Metro-Rent Out and Other-Metro-Rent Out) have enabled ads but all four of their keywords
("rent out villa online", "list bungalow for rent", "post independent house for rent", "rent out my independent house") are PAUSED, because they got zero impressions in 30 days (ads_keyword_cleanup_2026_10_08.py:
"a demand problem, not a wording one"). The four phrases below are different, owner-voice wordings from the category plan, not the paused ones, so this is a cheap test: a keyword with no search volume costs nothing.
If the groups still have zero impressions after 30 days, pause the ad groups instead.

Run: python ads_add_villa_rent_keywords.py --dry-run     read-only, prints exactly what would be added
     python ads_add_villa_rent_keywords.py --validate    Google validates the batch, nothing is created
     python ads_add_villa_rent_keywords.py               adds them (PHRASE match)
     python ads_add_villa_rent_keywords.py --remove      removes exactly these keywords again
"""

import argparse
import re

from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException

CID = "4214066478"
CAMPAIGNS = ["Metro-Rent Out Property (Owners)", "Other-Metro-Rent Out Property (Owners)"]
KEYWORDS = ["rent out my villa", "put my villa on rent", "list my villa for rent", "find tenants for my villa"]


def tokens(t):
    return re.findall(r"[a-z0-9.]+", t.lower())


def phrase_in(p, t):
    a, b = tokens(p), tokens(t)
    return any(b[i:i + len(a)] == a for i in range(len(b) - len(a) + 1))


def main():
    ap = argparse.ArgumentParser()
    mode = ap.add_mutually_exclusive_group()
    for m in ("dry-run", "validate", "remove"):
        mode.add_argument("--" + m, action="store_true")
    args = ap.parse_args()
    client = make_client()
    ga = client.get_service("GoogleAdsService")

    ops, plan = [], []
    for camp in CAMPAIGNS:
        groups = [(r.ad_group.name, r.ad_group.resource_name, r.ad_group.status.name) for r in ga.search(customer_id=CID, query=f"""
            SELECT ad_group.name, ad_group.resource_name, ad_group.status, campaign.name FROM ad_group
            WHERE campaign.name = '{camp}' AND ad_group.status != 'REMOVED'""") if r.ad_group.name.lower().startswith("ad group 2.3")]
        if len(groups) != 1:
            raise SystemExit("expected one 'Ad Group 2.3' in %s, found %d" % (camp, len(groups)))
        name, resource, status = groups[0]
        have = {r.ad_group_criterion.keyword.text.lower(): (r.ad_group_criterion.resource_name, r.ad_group_criterion.keyword.match_type.name)
                for r in ga.search(customer_id=CID, query=f"""
                    SELECT ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, ad_group_criterion.resource_name, ad_group_criterion.status
                    FROM ad_group_criterion WHERE ad_group.resource_name = '{resource}' AND ad_group_criterion.type = 'KEYWORD'
                      AND ad_group_criterion.negative = FALSE AND ad_group_criterion.status != 'REMOVED'""")}
        negatives = [r.campaign_criterion.keyword.text for r in ga.search(customer_id=CID, query=f"""
            SELECT campaign.name, campaign_criterion.keyword.text FROM campaign_criterion
            WHERE campaign.name = '{camp}' AND campaign_criterion.type = 'KEYWORD' AND campaign_criterion.negative = TRUE""")]
        print("%s / %s [%s]" % (camp, name.encode("ascii", "replace").decode(), status))
        for kw in KEYWORDS:
            blocked = next((n for n in negatives if phrase_in(n, kw)), None)
            if args.remove:
                if kw in have and have[kw][1] == "PHRASE":
                    op = client.get_type("MutateOperation")
                    op.ad_group_criterion_operation.remove = have[kw][0]
                    ops.append(op)
                    print("    remove  " + kw)
            elif blocked:
                print("    SKIP    %-32s blocked by the campaign negative %r" % (kw, blocked))
            elif kw in have:
                print("    SKIP    %-32s already there" % kw)
            else:
                plan.append((resource, kw))
                print("    add     " + kw)
    if args.dry_run:
        return
    for resource, kw in plan:
        op = client.get_type("MutateOperation")
        c = op.ad_group_criterion_operation.create
        c.ad_group = resource
        c.status = client.enums.AdGroupCriterionStatusEnum.ENABLED
        c.keyword.text = kw
        c.keyword.match_type = client.enums.KeywordMatchTypeEnum.PHRASE
        ops.append(op)
    if not ops:
        print("nothing to do")
        return
    request = client.get_type("MutateGoogleAdsRequest")
    request.customer_id = CID
    request.mutate_operations.extend(ops)
    request.validate_only = args.validate
    try:
        ga.mutate(request=request)
    except GoogleAdsException as e:
        raise SystemExit("mutate failed:\n%s" % "\n".join("  " + er.message for er in e.failure.errors))
    print("validated only - nothing changed (%d operations)" % len(ops) if args.validate else "done: %d operations" % len(ops))


if __name__ == "__main__":
    main()
