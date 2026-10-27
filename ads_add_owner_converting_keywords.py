"""Adds phrase-match keywords for search terms that already CONVERT in the owner/poster campaigns but are not keywords yet.

Why: in the last 30 days 126 search terms led to a 'post ad' conversion and only 9 were keywords (the rest arrived through phrase matches of other
keywords). Making the best ones keywords of their own secures them (own quality score and bid) without changing any existing keyword's quality score or ad rank.
Plan and rules: docs/plans/google-ads-keyword-audit-2026-10.md ("Adding proven converters, 2026-10-27").

Rules: PHRASE match only, each term goes into the ad group where it already converts (no new ad groups, existing ads untouched), nothing is added that
already exists in that ad group (any status), and nothing that a campaign negative would block. Left out on purpose: tenant-side searches, competitor-like
terms, and "property sale" (phrase match would also catch "property sale in <city>" buyers).

Run: python ads_add_owner_converting_keywords.py --dry-run      read-only, prints exactly what would be added where
     python ads_add_owner_converting_keywords.py --validate     Google validates the batch, nothing is created
     python ads_add_owner_converting_keywords.py                adds them
     python ads_add_owner_converting_keywords.py --remove       removes exactly these keywords again (rollback)
"""

import argparse
import re
from collections import defaultdict

from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException

CID = "4214066478"

# (campaign, ad group name prefix, [keywords]); 30-day conversions in the comments
PLAN = [
    ("Metro-Rent Out Property (Owners)", "ad group 2.1", [
        "rent my property",                    # 5
        "post property for rent in bangalore",  # 4
        "post property for rent",              # 3
        "rent out property",                   # 2
        "free listing of property for rent",   # 2
        "post property for rent free",         # 2
    ]),
    ("Metro-Generic Post Ad Intent", "ad group 1", [
        "free property ads posting sites in india",  # 3
        "free property listing sites",               # 2
        "post your property for rent",               # 2
        "post property ad",                          # 2
    ]),
    ("Metro-Sell Property (Owners/Agents)", "ad group 1.1", [
        "post free property ads",       # 3
        "free posting property ads",    # 3
        "property sell",                # 2
        "free real estate ads",         # 2
        "free property sale sites",     # 2
    ]),
    ("Other-Metro-Rent Out Property (Owners)", "ad group 2.1", ["property post for rent"]),  # 2
    ("Other-Metro-Generic Post Ad Intent", "ad group 1", ["free property listing"]),         # 2
    ("Other-Metro-Sell Property (Owners/Agents)", "ad group 1.1", ["property selling websites"]),  # 2
    ("Other-Metro-Sell Property (Owners/Agents)", "ad group 1.2", ["sell your flat"]),        # 2
]


def tokens(text):
    return re.findall(r"[a-z0-9.]+", text.lower())


def phrase_in(phrase, text):
    p, t = tokens(phrase), tokens(text)
    return any(t[i:i + len(p)] == p for i in range(len(t) - len(p) + 1))


def main():
    ap = argparse.ArgumentParser()
    mode = ap.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true")
    mode.add_argument("--validate", action="store_true")
    mode.add_argument("--remove", action="store_true")
    args = ap.parse_args()

    client = make_client()
    ga = client.get_service("GoogleAdsService")
    camps = sorted({c for c, _, _ in PLAN})
    names = ",".join("'%s'" % c for c in camps)

    groups = {}  # (campaign, prefix) -> (ad group resource, full name)
    for r in ga.search(customer_id=CID, query=f"""
        SELECT campaign.name, ad_group.name, ad_group.resource_name, ad_group.status FROM ad_group
        WHERE campaign.name IN ({names}) AND ad_group.status != 'REMOVED'"""):
        for c, prefix, _ in PLAN:
            if r.campaign.name == c and r.ad_group.name.lower().startswith(prefix):
                groups[(c, prefix)] = (r.ad_group.resource_name, r.ad_group.name, r.ad_group.status.name)

    have = defaultdict(dict)  # ad group resource -> text.lower() -> (criterion resource, status, match type)
    for r in ga.search(customer_id=CID, query=f"""
        SELECT ad_group.resource_name, ad_group_criterion.resource_name, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type,
               ad_group_criterion.status
        FROM ad_group_criterion WHERE campaign.name IN ({names}) AND ad_group_criterion.type = 'KEYWORD'
          AND ad_group_criterion.negative = FALSE AND ad_group_criterion.status != 'REMOVED'"""):
        c = r.ad_group_criterion
        have[r.ad_group.resource_name][c.keyword.text.lower()] = (c.resource_name, c.status.name, c.keyword.match_type.name)

    negatives = defaultdict(list)
    for r in ga.search(customer_id=CID, query=f"""
        SELECT campaign.name, campaign_criterion.keyword.text FROM campaign_criterion
        WHERE campaign.name IN ({names}) AND campaign_criterion.type = 'KEYWORD' AND campaign_criterion.negative = TRUE"""):
        negatives[r.campaign.name].append(r.campaign_criterion.keyword.text)

    adds, removes = [], []
    for c, prefix, kws in PLAN:
        g = groups.get((c, prefix))
        if not g:
            print("MISSING ad group %r in %s - skipped" % (prefix, c))
            continue
        resource, full, status = g
        print("%s / %s [%s]" % (c, full.encode("ascii", "replace").decode(), status))
        for text in kws:
            blocked = next((n for n in negatives[c] if phrase_in(n, text)), None)
            exists = have[resource].get(text.lower())
            if args.remove:
                if exists and exists[2] == "PHRASE":
                    removes.append(exists[0])
                    print("    remove  %s" % text)
                continue
            if blocked:
                print("    SKIP    %-44s blocked by the campaign negative %r" % (text, blocked))
            elif exists:
                print("    SKIP    %-44s already in this ad group (%s, %s)" % (text, exists[2], exists[1]))
            else:
                adds.append((resource, text))
                print("    add     %s" % text)
    print("\n%s" % (("keywords to remove: %d" % len(removes)) if args.remove else ("keywords to add: %d (phrase match)" % len(adds))))
    if args.dry_run:
        return

    ops = []
    for resource, text in adds:
        op = client.get_type("MutateOperation")
        kw = op.ad_group_criterion_operation.create
        kw.ad_group = resource
        kw.status = client.enums.AdGroupCriterionStatusEnum.ENABLED
        kw.keyword.text = text
        kw.keyword.match_type = client.enums.KeywordMatchTypeEnum.PHRASE
        ops.append(op)
    for criterion in removes:
        op = client.get_type("MutateOperation")
        op.ad_group_criterion_operation.remove = criterion
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
