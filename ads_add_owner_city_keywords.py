"""Adds owner-phrased, city-named phrase keywords to Metro-Rent Out Property (Owners) ad groups 2.1 / 2.2 / 2.4.

Why: the city-named Seeker groups pay ~Rs13-15 a click against ~Rs25-30 for the generic owner keywords in these groups.
Location words are cheaper, but a bare city phrase ("pg in bangalore") is a seeker. So every keyword here pairs the city
with the owner's own wording ("rent out my flat in bangalore") - a phrase only someone with a property types.
docs/plans/owner-keywords-by-category-and-transaction.md ("City-named owner keywords") has the reasoning.

Safety: every generated phrase must NOT classify as "seeker" in ads_intent.classify() or nothing is sent; phrases already
in the ad group (any status) are skipped; phrases a campaign/ad-group negative would block are reported and skipped.
Match type is PHRASE, like the rest of the campaign. Bidding, ads and landing pages are untouched. Idempotent.

--variant short swaps in looser, shorter phrases ("rent out flat bangalore") in case the long ones stay at low search volume.

Run: python ads_add_owner_city_keywords.py --dry-run     read-only, prints exactly what would be added
     python ads_add_owner_city_keywords.py --validate    Google validates the batch, nothing is created
     python ads_add_owner_city_keywords.py               applies it
"""

import argparse

from ads_intent import classify
from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException

CID = "4214066478"
CAMPAIGN_NAME = "Metro-Rent Out Property (Owners)"
CITIES = ["bengaluru", "bangalore", "hyderabad", "chennai", "mumbai", "delhi", "pune", "kolkata"]

# ad group id (see apps/bff/src/ads/campaign-names.ts) -> templates; {c} is the city
GROUPS = {
    "199595834373": ("2.1 Rent Out House/Apartment", [
        "rent out my flat in {c}",
        "rent out my house in {c}",
        "list my house for rent in {c}",
        "post my house for rent in {c}",
        "post rental property in {c}",
        "list my flat for rent in {c}",
    ]),
    "201241143962": ("2.2 Rent Out PG", [
        "list my pg in {c}",
        "post pg ad in {c}",
    ]),
    "199363402229": ("2.4 Rent Out Commercial", [
        "rent out my shop in {c}",
        "rent out my office in {c}",
        "rent out my warehouse in {c}",
        "list my commercial property for rent in {c}",
    ]),
}

# Shorter, looser word order for when the long phrases above sit at "low search volume". Each still carries an
# owner marker (rent out / post / list my) so ads_intent.classify() never reads it as a seeker.
GROUPS_SHORT = {
    "199595834373": ("2.1 Rent Out House/Apartment", [
        "rent out flat {c}",
        "rent out house {c}",
        "post rental property {c}",
        "post property {c}",
    ]),
    "201241143962": ("2.2 Rent Out PG", [
        "list my pg {c}",
        "post pg {c}",
    ]),
    "199363402229": ("2.4 Rent Out Commercial", [
        "rent out shop {c}",
        "rent out office {c}",
        "rent out warehouse {c}",
        "post commercial property {c}",
    ]),
}


def blocked_by(text, negatives):
    """First negative that would stop this phrase-match keyword, else None."""
    words = text.split()
    for neg_text, match_type in negatives:
        nw = neg_text.split()
        if match_type == "EXACT":
            hit = nw == words
        elif match_type == "PHRASE":
            hit = any(words[i:i + len(nw)] == nw for i in range(len(words) - len(nw) + 1))
        else:  # BROAD: every word present
            hit = all(w in words for w in nw)
        if hit:
            return "%s [%s]" % (neg_text, match_type)
    return None


def main():
    p = argparse.ArgumentParser()
    mode = p.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true")
    mode.add_argument("--validate", action="store_true")
    p.add_argument("--variant", choices=["long", "short"], default="long",
                   help="long = applied 2026-10-22; short = looser fallback (not applied)")
    args = p.parse_args()
    groups = GROUPS_SHORT if args.variant == "short" else GROUPS

    client = make_client()
    ga = client.get_service("GoogleAdsService")
    enums = client.enums
    rows = lambda q: list(ga.search(customer_id=CID, query=q))

    tag = "   [DRY RUN]" if args.dry_run else "   [VALIDATE ONLY]" if args.validate else ""
    print("Account %s%s\n" % (CID, tag))

    campaign_negs = [
        (r.campaign_criterion.keyword.text.lower(), r.campaign_criterion.keyword.match_type.name)
        for r in rows(f"""SELECT campaign_criterion.keyword.text, campaign_criterion.keyword.match_type
            FROM campaign_criterion WHERE campaign.name = '{CAMPAIGN_NAME}'
            AND campaign_criterion.type = 'KEYWORD' AND campaign_criterion.negative = TRUE""")
    ]

    # --- build and check the plan
    plan = []  # (ad_group_resource, label, text)
    problems = []
    for ag_id, (label, templates) in groups.items():
        resource = "customers/%s/adGroups/%s" % (CID, ag_id)
        found = rows(f"""SELECT ad_group.name, ad_group.campaign, campaign.name FROM ad_group WHERE ad_group.id = {ag_id}""")
        if not found or found[0].campaign.name != CAMPAIGN_NAME:
            raise SystemExit("ad group %s (%s) not found in %s" % (ag_id, label, CAMPAIGN_NAME))

        existing = {
            (r.ad_group_criterion.keyword.text.lower(), r.ad_group_criterion.keyword.match_type.name)
            for r in rows(f"""SELECT ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type
                FROM ad_group_criterion WHERE ad_group.id = {ag_id} AND ad_group_criterion.type = 'KEYWORD'
                AND ad_group_criterion.negative = FALSE AND ad_group_criterion.status != 'REMOVED'""")
        }
        group_negs = campaign_negs + [
            (r.ad_group_criterion.keyword.text.lower(), r.ad_group_criterion.keyword.match_type.name)
            for r in rows(f"""SELECT ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type
                FROM ad_group_criterion WHERE ad_group.id = {ag_id} AND ad_group_criterion.type = 'KEYWORD'
                AND ad_group_criterion.negative = TRUE""")
        ]

        print("Ad Group %s: %d existing keyword(s)" % (label, len(existing)))
        for city in CITIES:
            for template in templates:
                text = template.format(c=city)
                if classify(text) == "seeker":
                    problems.append("reads as a seeker: " + text)
                    continue
                if (text, "PHRASE") in existing:
                    print("  skip (exists)   %s" % text)
                    continue
                neg = blocked_by(text, group_negs)
                if neg:
                    print("  skip (negative) %-45s blocked by %s" % (text, neg))
                    continue
                plan.append((resource, label, text))
    if problems:
        raise SystemExit("not sending anything:\n  " + "\n  ".join(problems))

    print("\nkeywords to add: %d" % len(plan))
    for _, label, text in plan:
        print("  + [%-28s] %s" % (label, text))
    if args.dry_run or not plan:
        if not plan:
            print("Nothing to do - already in sync.")
        else:
            print("\n[dry run] %d keyword(s) planned, nothing sent." % len(plan))
        return

    ops = []
    for resource, _, text in plan:
        op = client.get_type("AdGroupCriterionOperation")
        op.create.ad_group = resource
        op.create.status = enums.AdGroupCriterionStatusEnum.ENABLED
        op.create.keyword.text = text
        op.create.keyword.match_type = enums.KeywordMatchTypeEnum.PHRASE
        ops.append(op)
    try:
        client.get_service("AdGroupCriterionService").mutate_ad_group_criteria(
            request={"customer_id": CID, "operations": ops, "validate_only": args.validate})
    except GoogleAdsException as e:
        raise SystemExit("mutate failed:\n%s" % "\n".join(
            "  %s (%s)" % (er.message, er.location.field_path_elements[-1].field_name
                           if er.location.field_path_elements else "-") for er in e.failure.errors))
    if args.validate:
        print("\n[validate only] Google accepted all %d operation(s); nothing was created." % len(ops))
    else:
        print("\napplied %d keyword(s)." % len(ops))


if __name__ == "__main__":
    main()
