"""Removes junk keywords from the owner/poster campaigns and adds competitor-name negatives to them.

Campaigns: every Metro-* and Other-Metro-* campaign except the two seeker campaigns (their negatives are in ads_add_seeker_negatives.py).
Why and how the list was chosen: docs/plans/google-ads-keyword-audit-2026-10.md ("Poster keyword cleanup, 2026-10-27").

REMOVES (not pauses) keywords that are not owners looking to post, and that got no impression and no cost in the last 30 days:
  - competitor and portal names:  99 acres, 99acres rent house, property 24, olx rent for house, justco coworking space, home4rent
  - unrelated phrases:            apna ... kaise beche / bache, digital products selling websites free, noida property rates,
                                  corporate leasing companies
  - tenant-side phrases (people looking for a home, not owners): house for rent, house rent, rent house, lease house
A keyword is only removed if it had zero impressions and zero cost in the last 30 days (anything that has traffic is listed and skipped).
Every removed keyword is saved to ads_removed_keywords_2026-10-27.json first, and --restore re-creates them from that file.
(On 2026-10-27 the owner had already removed these keywords in the Ads UI before the script ran, so it only added the negatives.)

ADDS phrase-match negatives (competitor names) to the same campaigns, skipping any that would block a keyword we still bid on.

Run: python ads_clean_poster_keywords.py --dry-run      read-only, prints exactly what would be removed and added
     python ads_clean_poster_keywords.py --validate     Google validates the batch, nothing changes
     python ads_clean_poster_keywords.py                removes the keywords and adds the negatives
     python ads_clean_poster_keywords.py --restore      re-creates the removed keywords and removes the negatives added here
"""

import argparse
import json
import os
import re
from collections import defaultdict

from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException

CID = "4214066478"
BACKUP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ads_removed_keywords_2026-10-27.json")
CAMP_FILTER = "campaign.name REGEXP_MATCH '^(Metro|Other-Metro)-.*' AND campaign.name NOT LIKE '%Seeker%'"

REMOVE_TEXTS = {
    "99 acres": "competitor", "99acres rent house": "competitor", "property 24": "competitor", "olx rent for house": "competitor",
    "justco coworking space": "competitor", "home4rent": "competitor",
    "apna koi product online kaise beche": "unrelated", "apna product online kaise bache": "unrelated",
    "apna saman online kaise beche": "unrelated", "digital products selling websites free": "unrelated",
    "noida property rates": "unrelated", "corporate leasing companies": "unrelated",
    "house for rent": "tenant-side", "house rent": "tenant-side", "rent house": "tenant-side", "lease house": "tenant-side",
    "nobroker post free ad": "competitor",
}
# Removed on the owner's explicit instruction even though it has traffic (the others are only removed when they have none).
FORCE_REMOVE = {"nobroker post free ad"}

NEGATIVES = [
    "olx", "99acres", "99 acres", "magicbricks", "magic bricks", "nobroker", "quikr", "quicker home", "quicker homes", "nestaway",
    "commonfloor", "sulekha", "squareyards", "square yards", "makaan", "proptiger", "home4rent", "justco", "zolo", "colive",
    "stanza living", "housing.com", "housing com", "property24",
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
    mode.add_argument("--restore", action="store_true")
    args = ap.parse_args()

    client = make_client()
    ga = client.get_service("GoogleAdsService")

    campaigns = {r.campaign.name: r.campaign.resource_name for r in ga.search(customer_id=CID, query=f"""
        SELECT campaign.name, campaign.resource_name FROM campaign WHERE {CAMP_FILTER} AND campaign.status != 'REMOVED'""")}
    if not campaigns:
        raise SystemExit("no poster campaigns found")

    if args.restore:
        restore(client, ga, campaigns)
        return

    # keywords with their 30-day traffic
    kws = {}
    for r in ga.search(customer_id=CID, query=f"""
        SELECT campaign.name, ad_group.name, ad_group.resource_name, ad_group_criterion.resource_name, ad_group_criterion.keyword.text,
               ad_group_criterion.keyword.match_type, ad_group_criterion.status
        FROM ad_group_criterion WHERE {CAMP_FILTER} AND ad_group_criterion.type = 'KEYWORD' AND ad_group_criterion.negative = FALSE
          AND ad_group_criterion.status != 'REMOVED'"""):
        c = r.ad_group_criterion
        kws[c.resource_name] = dict(campaign=r.campaign.name, ad_group=r.ad_group.name, ad_group_resource=r.ad_group.resource_name,
                                    criterion=c.resource_name, text=c.keyword.text, match_type=c.keyword.match_type.name,
                                    status=c.status.name, impr=0, cost=0.0)
    for r in ga.search(customer_id=CID, query=f"""
        SELECT ad_group_criterion.resource_name, metrics.impressions, metrics.cost_micros FROM keyword_view
        WHERE {CAMP_FILTER} AND segments.date DURING LAST_30_DAYS"""):
        k = kws.get(r.ad_group_criterion.resource_name)
        if k:
            k["impr"] += r.metrics.impressions
            k["cost"] += r.metrics.cost_micros / 1e6

    to_remove, skipped = [], []
    for k in kws.values():
        if k["text"].lower() in REMOVE_TEXTS:
            (skipped if (k["impr"] or k["cost"]) and k["text"].lower() not in FORCE_REMOVE else to_remove).append(k)
    print("KEYWORDS TO REMOVE: %d" % len(to_remove))
    for why in ("competitor", "unrelated", "tenant-side"):
        group = [k for k in to_remove if REMOVE_TEXTS[k["text"].lower()] == why]
        print("  %s (%d)" % (why, len(group)))
        for k in sorted(group, key=lambda x: (x["text"], x["campaign"])):
            print("    %-40s %-34s %s" % (k["text"], k["campaign"], k["ad_group"].encode("ascii", "replace").decode()[:28]))
    if skipped:
        print("SKIPPED (has impressions or cost in 30 days, left alone): %d" % len(skipped))
        for k in skipped:
            print("    %-40s %-34s impr %d cost %.0f" % (k["text"], k["campaign"], k["impr"], k["cost"]))

    # negatives
    removing = {k["criterion"] for k in to_remove}
    remaining = [k["text"] for k in kws.values() if k["criterion"] not in removing]
    existing = defaultdict(set)
    for r in ga.search(customer_id=CID, query=f"""
        SELECT campaign.name, campaign_criterion.keyword.text FROM campaign_criterion
        WHERE {CAMP_FILTER} AND campaign_criterion.type = 'KEYWORD' AND campaign_criterion.negative = TRUE"""):
        existing[r.campaign.name].add(r.campaign_criterion.keyword.text.lower())
    usable = []
    for n in NEGATIVES:
        clash = next((t for t in remaining if phrase_in(n, t)), None)
        if clash:
            print("NEGATIVE SKIPPED %-16s would block a keyword we keep: %s" % (n, clash))
        else:
            usable.append(n)
    additions = [(c, n) for c in sorted(campaigns) for n in usable if n not in existing[c]]
    print("\nNEGATIVES (phrase) to add: %d across %d campaigns (%d phrases; already present are skipped)" % (len(additions), len(campaigns), len(usable)))
    print("  " + ", ".join(usable))

    if args.dry_run:
        return

    if not args.validate and to_remove:
        with open(BACKUP, "w", encoding="utf8") as f:
            json.dump({"removed_keywords": [{x: k[x] for x in ("campaign", "ad_group", "ad_group_resource", "text", "match_type", "status")} for k in to_remove],
                       "negatives_added": [{"campaign": c, "text": n} for c, n in additions]}, f, indent=1, ensure_ascii=False)
        print("\nbackup written: %s" % BACKUP)

    ops = []
    for k in to_remove:
        op = client.get_type("MutateOperation")
        op.ad_group_criterion_operation.remove = k["criterion"]
        ops.append(op)
    for c, n in additions:
        op = client.get_type("MutateOperation")
        crit = op.campaign_criterion_operation.create
        crit.campaign = campaigns[c]
        crit.negative = True
        crit.keyword.text = n
        crit.keyword.match_type = client.enums.KeywordMatchTypeEnum.PHRASE
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


def restore(client, ga, campaigns):
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
    wanted = {(n["campaign"], n["text"]) for n in data["negatives_added"]}
    for r in ga.search(customer_id=CID, query=f"""
        SELECT campaign.name, campaign_criterion.resource_name, campaign_criterion.keyword.text FROM campaign_criterion
        WHERE {CAMP_FILTER} AND campaign_criterion.type = 'KEYWORD' AND campaign_criterion.negative = TRUE"""):
        if (r.campaign.name, r.campaign_criterion.keyword.text) in wanted:
            op = client.get_type("MutateOperation")
            op.campaign_criterion_operation.remove = r.campaign_criterion.resource_name
            ops.append(op)
    send(client, ga, ops, False)


if __name__ == "__main__":
    main()
