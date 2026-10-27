"""Moves the seeker campaigns' negative keywords into ONE shared negative keyword list.

Today Metro-Seeker Intent and Other-Metro-Seeker Intent each carry the same negatives as individual campaign-level keywords
(6 older brand ones plus the 42 from ads_add_seeker_negatives.py). This creates the shared list 'Seeker Intent - negative keywords',
puts the union of those keywords in it (same text, same match type), attaches the list to both campaigns, and removes the now
duplicate individual negatives from both. From then on a new negative is added once, to the list.

Everything is ONE batch with a temporary id, so --validate checks the whole change and a real run either fully applies or not at all.
Coverage is unchanged: every keyword blocked before is blocked after. The campaigns' negative BRAND LIST (a different kind of
exclusion) is not touched.

Run: python ads_seeker_negative_list.py --dry-run      read-only, prints the list and what would be removed
     python ads_seeker_negative_list.py --validate     Google validates the batch, nothing changes
     python ads_seeker_negative_list.py                creates the list, attaches it, removes the individual negatives
     python ads_seeker_negative_list.py --rollback     puts the individual negatives back and deletes the list
"""

import argparse
from collections import defaultdict

from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException

CID = "4214066478"
CAMPAIGNS = ["Metro-Seeker Intent", "Other-Metro-Seeker Intent"]
LIST_NAME = "Seeker Intent - negative keywords"


def main():
    ap = argparse.ArgumentParser()
    mode = ap.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true")
    mode.add_argument("--validate", action="store_true")
    mode.add_argument("--rollback", action="store_true")
    args = ap.parse_args()

    client = make_client()
    ga = client.get_service("GoogleAdsService")
    names = ",".join("'%s'" % c for c in CAMPAIGNS)

    campaigns = {r.campaign.name: r.campaign.resource_name for r in ga.search(customer_id=CID, query=f"""
        SELECT campaign.name, campaign.resource_name FROM campaign WHERE campaign.name IN ({names}) AND campaign.status != 'REMOVED'""")}
    if set(campaigns) != set(CAMPAIGNS):
        raise SystemExit("campaigns found: %s" % sorted(campaigns))

    existing_set = None
    for r in ga.search(customer_id=CID, query=f"""
        SELECT shared_set.resource_name, shared_set.name FROM shared_set
        WHERE shared_set.type = 'NEGATIVE_KEYWORDS' AND shared_set.status = 'ENABLED' AND shared_set.name = '{LIST_NAME}'"""):
        existing_set = r.shared_set.resource_name

    if args.rollback:
        rollback(client, ga, campaigns, existing_set)
        return
    if existing_set:
        raise SystemExit("the list '%s' already exists (%s); not creating a second one" % (LIST_NAME, existing_set))

    # individual negatives on the two campaigns
    individual = defaultdict(list)  # (text, match_type) -> [criterion resource names]
    for r in ga.search(customer_id=CID, query=f"""
        SELECT campaign.name, campaign_criterion.resource_name, campaign_criterion.keyword.text, campaign_criterion.keyword.match_type
        FROM campaign_criterion WHERE campaign.name IN ({names}) AND campaign_criterion.type = 'KEYWORD'
          AND campaign_criterion.negative = TRUE"""):
        key = (r.campaign_criterion.keyword.text, r.campaign_criterion.keyword.match_type.name)
        individual[key].append((r.campaign.name, r.campaign_criterion.resource_name))
    keywords = sorted(individual)
    print("list '%s': %d distinct negative keywords (union of both campaigns)" % (LIST_NAME, len(keywords)))
    only_one = [k for k in keywords if len({c for c, _ in individual[k]}) == 1]
    for k in only_one:
        print("  note: only on %s: %s [%s]" % (individual[k][0][0], k[0], k[1]))
    print("attach to: %s" % ", ".join(CAMPAIGNS))
    print("individual campaign-level negatives to remove afterwards: %d" % sum(len(v) for v in individual.values()))
    print("sample: " + ", ".join("%s [%s]" % k for k in keywords[:10]) + " ...")
    if args.dry_run:
        return

    shared_service = client.get_service("SharedSetService")
    set_resource = shared_service.shared_set_path(CID, -1)
    ops = []
    op = client.get_type("MutateOperation")
    s = op.shared_set_operation.create
    s.resource_name = set_resource
    s.name = LIST_NAME
    s.type_ = client.enums.SharedSetTypeEnum.NEGATIVE_KEYWORDS
    ops.append(op)
    for text, match_type in keywords:
        op = client.get_type("MutateOperation")
        c = op.shared_criterion_operation.create
        c.shared_set = set_resource
        c.keyword.text = text
        c.keyword.match_type = client.enums.KeywordMatchTypeEnum[match_type]
        ops.append(op)
    for resource in campaigns.values():
        op = client.get_type("MutateOperation")
        link = op.campaign_shared_set_operation.create
        link.campaign = resource
        link.shared_set = set_resource
        ops.append(op)
    for entries in individual.values():
        for _campaign, criterion in entries:
            op = client.get_type("MutateOperation")
            op.campaign_criterion_operation.remove = criterion
            ops.append(op)
    send(client, ga, ops, args.validate)


def send(client, ga, ops, validate):
    request = client.get_type("MutateGoogleAdsRequest")
    request.customer_id = CID
    request.mutate_operations.extend(ops)
    request.validate_only = validate
    try:
        ga.mutate(request=request)
    except GoogleAdsException as e:
        raise SystemExit("mutate failed:\n%s" % "\n".join("  " + er.message for er in e.failure.errors))
    print("validated only - nothing changed (%d operations)" % len(ops) if validate else "done: %d operations" % len(ops))


def rollback(client, ga, campaigns, set_resource):
    if not set_resource:
        raise SystemExit("list '%s' not found; nothing to roll back" % LIST_NAME)
    keywords = [(r.shared_criterion.keyword.text, r.shared_criterion.keyword.match_type.name, r.shared_criterion.resource_name)
                for r in ga.search(customer_id=CID, query=f"""
                    SELECT shared_criterion.resource_name, shared_criterion.keyword.text, shared_criterion.keyword.match_type
                    FROM shared_criterion WHERE shared_set.resource_name = '{set_resource}'""")]
    ops = []
    for resource in campaigns.values():
        for text, match_type, _ in keywords:
            op = client.get_type("MutateOperation")
            crit = op.campaign_criterion_operation.create
            crit.campaign = resource
            crit.negative = True
            crit.keyword.text = text
            crit.keyword.match_type = client.enums.KeywordMatchTypeEnum[match_type]
            ops.append(op)
    for r in ga.search(customer_id=CID, query=f"""
        SELECT campaign_shared_set.resource_name FROM campaign_shared_set
        WHERE shared_set.resource_name = '{set_resource}' AND campaign_shared_set.status = 'ENABLED'"""):
        op = client.get_type("MutateOperation")
        op.campaign_shared_set_operation.remove = r.campaign_shared_set.resource_name
        ops.append(op)
    op = client.get_type("MutateOperation")
    op.shared_set_operation.remove = set_resource
    ops.append(op)
    send(client, ga, ops, False)


if __name__ == "__main__":
    main()
