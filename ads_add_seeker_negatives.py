"""Adds phrase-match negative keywords to the two seeker campaigns (Metro-Seeker Intent, Other-Metro-Seeker Intent) for search terms
that cost clicks and are not renters looking for a home: roommate / flatmate sites, competitor and portal names, "how to" questions,
rental agencies, and a few non-property words (only those that actually appeared).

Why and how the list was chosen: docs/plans/seeker-intent-campaign.md ("Negative keywords, 2026-10-27"). Every candidate was checked against the
last 30 days of search terms for both campaigns (the dry run prints what each one would have blocked), and against the campaigns' own
keywords, so a negative can never block a keyword we bid on. Deliberately NOT negatives: "website", "sites", "app" (people searching for a rental
site or app are exactly our users), "no broker" / "without broker" (a strong seeker query for us), "pg", "room", and buy words ("for sale", "lakhs"),
which would also block the Buy ad groups if they are ever switched on.

Run: python ads_add_seeker_negatives.py --dry-run     read-only, prints each negative and the terms it would have blocked
     python ads_add_seeker_negatives.py --validate    Google validates the batch, nothing is created
     python ads_add_seeker_negatives.py               adds them
     python ads_add_seeker_negatives.py --remove      removes exactly the negatives this script adds (rollback)
"""

import argparse
import re
from collections import defaultdict

from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException

CID = "4214066478"
CAMPAIGNS = ["Metro-Seeker Intent", "Other-Metro-Seeker Intent"]

# (negative phrase, group, always) - `always` ones are added even when no recent term matched; the others only if they matched a term.
NEGATIVES = [
    # roommate / flatmate / sharing sites and searches
    ("flatmate", "roommate", True), ("flatmates", "roommate", True), ("flat mate", "roommate", True), ("flat mates", "roommate", True),
    ("roommate", "roommate", True), ("roommates", "roommate", True), ("room mate", "roommate", True), ("flat sharing", "roommate", True),
    ("flat share", "roommate", True), ("flashmates", "roommate", True), ("flatx", "roommate", True), ("findmyroom", "roommate", True),
    # competitor and portal names (phrase match; "no broker" / "without broker" are NOT blocked, only the brand)
    ("olx", "brand", True), ("magic bricks", "brand", True), ("magicbricks", "brand", True), ("99acres", "brand", True),
    ("nobroker", "brand", True), ("commonfloor", "brand", True), ("sulekha", "brand", True), ("squareyards", "brand", True),
    ("square yards", "brand", True), ("makaan", "brand", True), ("proptiger", "brand", True), ("quikr", "brand", True),
    ("golanirentals", "brand", True), ("golani rentals", "brand", True), ("rently", "brand", True), ("werent", "brand", True),
    ("propscanly", "brand", True), ("zolo", "brand", True), ("colive", "brand", True), ("stanza living", "brand", True),
    ("mylapore times", "brand", True),
    # questions and guides (no intent to see listings now)
    ("how to", "informational", True), ("where to search", "informational", True), ("best way to find", "informational", True),
    # agencies and agents (they want an agent, we are direct-from-owner)
    ("rental agency", "agency", True), ("rental agencies", "agency", True), ("property agent", "agency", True),
    ("property agents", "agency", True), ("estate agent", "agency", True), ("estate agents", "agency", True),
    # not a home to rent: only if they actually showed up
    ("rent agreement", "other", False), ("rental agreement", "other", False), ("agreement format", "other", False),
    ("hra", "other", False), ("calculator", "other", False), ("pdf", "other", False), ("jobs", "other", False),
    ("car rental", "other", False), ("bike rental", "other", False), ("bike on rent", "other", False), ("car on rent", "other", False),
    ("camera", "other", False), ("dress", "other", False), ("furniture rental", "other", False),
    ("wedding", "other", False), ("banquet", "other", False), ("lakhs", "other", False),
]
# "lakhs" is listed above only so the dry run reports how often buy-priced queries reach the rent groups; it is dropped below
# (it would block the Buy ad groups) and never sent.
NEVER_SEND = {"lakhs"}


def tokens(text):
    return re.findall(r"[a-z0-9.]+", text.lower())


def phrase_in(phrase, text):
    """Phrase match: the negative's words appear in order, as whole words, in the search term."""
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
    names = ",".join("'%s'" % c for c in CAMPAIGNS)

    campaigns = {r.campaign.name: r.campaign.resource_name for r in ga.search(customer_id=CID, query=f"""
        SELECT campaign.name, campaign.resource_name FROM campaign WHERE campaign.name IN ({names}) AND campaign.status != 'REMOVED'""")}
    if set(campaigns) != set(CAMPAIGNS):
        raise SystemExit("campaigns found: %s" % sorted(campaigns))

    # existing negatives per campaign
    existing = defaultdict(dict)  # campaign -> text -> criterion resource
    for r in ga.search(customer_id=CID, query=f"""
        SELECT campaign.name, campaign_criterion.resource_name, campaign_criterion.keyword.text, campaign_criterion.keyword.match_type
        FROM campaign_criterion WHERE campaign.name IN ({names}) AND campaign_criterion.type = 'KEYWORD' AND campaign_criterion.negative = TRUE"""):
        existing[r.campaign.name][r.campaign_criterion.keyword.text.lower()] = (r.campaign_criterion.resource_name, r.campaign_criterion.keyword.match_type.name)

    # search terms, last 30 days, both campaigns
    terms = defaultdict(lambda: [0, 0, 0.0])
    for r in ga.search(customer_id=CID, query=f"""
        SELECT search_term_view.search_term, metrics.impressions, metrics.clicks, metrics.cost_micros
        FROM search_term_view WHERE campaign.name IN ({names}) AND segments.date DURING LAST_30_DAYS"""):
        t = terms[r.search_term_view.search_term]
        t[0] += r.metrics.impressions
        t[1] += r.metrics.clicks
        t[2] += r.metrics.cost_micros / 1e6

    # our own positive keywords: a negative must never match one of them
    own = [r.ad_group_criterion.keyword.text for r in ga.search(customer_id=CID, query=f"""
        SELECT ad_group_criterion.keyword.text FROM ad_group_criterion
        WHERE campaign.name IN ({names}) AND ad_group_criterion.type = 'KEYWORD' AND ad_group_criterion.negative = FALSE
          AND ad_group_criterion.status != 'REMOVED'""")]

    plan = []
    print("%-22s %-14s %5s %5s %7s  %s" % ("negative (phrase)", "group", "terms", "clk", "cost", "example blocked terms"))
    for phrase, group, always in NEGATIVES:
        hit = [(t, v) for t, v in terms.items() if phrase_in(phrase, t)]
        clicks = sum(v[1] for _, v in hit)
        cost = sum(v[2] for _, v in hit)
        clash = [k for k in own if phrase_in(phrase, k)]
        if clash:
            print("SKIP %-18s would block our own keyword: %s" % (phrase, clash[0]))
            continue
        send = (always or hit) and phrase not in NEVER_SEND
        examples = ", ".join(t for t, _ in sorted(hit, key=lambda x: -x[1][2])[:3])
        print("%-22s %-14s %5d %5d %7.0f  %s%s" % (phrase, group, len(hit), clicks, cost, examples[:70], "" if send else "   [not sent]"))
        if send:
            plan.append(phrase)

    todo = {c: [p for p in plan if p not in existing[c]] for c in CAMPAIGNS}
    print()
    for c in CAMPAIGNS:
        print("%s: %d to add, %d already present" % (c, len(todo[c]), len(plan) - len(todo[c])))

    if args.dry_run:
        return

    ops = []
    if args.remove:
        for c in CAMPAIGNS:
            for p in plan:
                if p in existing[c] and existing[c][p][1] == "PHRASE":
                    op = client.get_type("MutateOperation")
                    op.campaign_criterion_operation.remove = existing[c][p][0]
                    ops.append(op)
    else:
        for c in CAMPAIGNS:
            for p in todo[c]:
                op = client.get_type("MutateOperation")
                crit = op.campaign_criterion_operation.create
                crit.campaign = campaigns[c]
                crit.negative = True
                crit.keyword.text = p
                crit.keyword.match_type = client.enums.KeywordMatchTypeEnum.PHRASE
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
