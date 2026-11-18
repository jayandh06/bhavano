"""Adds owner-phrased COWORKING and COMMERCIAL (office / shop) keywords, generic and city-named, to "Ad Group 2.6 - Rent Out Coworking" and
"Ad Group 2.4 - Rent Out Commercial" in Metro-Rent Out Property (Owners), plus generic ones in Other-Metro-Rent Out 2.4.

Commercial: "rent my office space" showed no ad either. Group 2.4 had only city-named phrases ("rent out my office in bangalore", all Rarely served)
and one generic "list commercial space for rent"; nothing for "rent my office (space)", "rent my shop", "lease my office".

Why: "rent my coworking space" and "rent my coworking space in bangalore" showed no Bhavano ad. The group (created 2026-10-29) had 8 phrases,
none of them "rent my coworking space" (closest: "rent out my coworking space", missing "out" in the searcher's words; phrase match keeps order),
no "lease" wording, and no city-named phrases; 7 of the 8 were flagged Rarely served (low search volume), 13 impressions in 30 days.

Same safety as ads_add_owner_sell_keywords.py: seeker-reading phrases never sent, phrases already in the campaign or blocked by a negative
skipped, PHRASE match, no "free", bids / ads / landing pages untouched, idempotent. Cities = the Metro markets targeted today.

Run: python ads_add_owner_coworking_keywords.py --dry-run | --validate | (no flag = apply)
"""

import argparse

from ads_add_owner_city_keywords import blocked_by
from ads_intent import classify
from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException

CID = "4214066478"

CAMPAIGNS = {
    "Metro-Rent Out Property (Owners)": [
        "bengaluru", "bangalore", "hyderabad", "chennai", "mumbai", "delhi", "pune", "gurgaon", "noida"],
    "Other-Metro-Rent Out Property (Owners)": [],  # generic phrases only; its city list was not re-checked
}

GROUPS = {
    "Ad Group 2.6": (
        ["rent my coworking space", "rent out coworking space", "lease my coworking space", "lease out coworking space",
         "list my coworking space for rent", "put my coworking space on rent", "rent out my coworking desks"],
        ["rent my coworking space in {c}", "rent out my coworking space in {c}", "list my coworking space in {c}",
         "lease my coworking space in {c}"]),
    "Ad Group 2.4": (
        ["rent my office space", "rent my office", "rent out my office space", "rent out my office", "lease my office space",
         "lease out my office", "rent my shop", "rent out my shop", "lease my shop", "rent my commercial space",
         "rent out my commercial property", "rent out my warehouse", "rent my showroom", "list my office space for rent",
         "list my shop for rent"],
        ["rent my office space in {c}", "rent my office in {c}", "lease my office space in {c}", "rent my shop in {c}",
         "lease my shop in {c}", "rent out my commercial space in {c}"]),
}


def main():
    p = argparse.ArgumentParser()
    mode = p.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true")
    mode.add_argument("--validate", action="store_true")
    args = p.parse_args()

    client = make_client()
    ga = client.get_service("GoogleAdsService")
    enums = client.enums
    rows = lambda q: list(ga.search(customer_id=CID, query=q))

    tag = "   [DRY RUN]" if args.dry_run else "   [VALIDATE ONLY]" if args.validate else ""
    print("Account %s%s\n" % (CID, tag))

    plan, problems = [], []  # plan: (ad_group_resource, label, text)
    for camp, cities in CAMPAIGNS.items():
        campaign_negs = [
            (r.campaign_criterion.keyword.text.lower(), r.campaign_criterion.keyword.match_type.name)
            for r in rows(f"""SELECT campaign_criterion.keyword.text, campaign_criterion.keyword.match_type
                FROM campaign_criterion WHERE campaign.name = '{camp}'
                AND campaign_criterion.type = 'KEYWORD' AND campaign_criterion.negative = TRUE""")]
        # every positive keyword text in the campaign, any ad group / status / match type
        in_campaign = {
            r.ad_group_criterion.keyword.text.lower()
            for r in rows(f"""SELECT ad_group_criterion.keyword.text FROM ad_group_criterion
                WHERE campaign.name = '{camp}' AND ad_group_criterion.type = 'KEYWORD'
                AND ad_group_criterion.negative = FALSE AND ad_group_criterion.status != 'REMOVED'""")}
        groups = {r.ad_group.name: r.ad_group.id
                  for r in rows(f"""SELECT ad_group.id, ad_group.name FROM ad_group
                      WHERE campaign.name = '{camp}' AND ad_group.status = 'ENABLED'""")}

        print("== %s: %d keyword text(s) already present" % (camp, len(in_campaign)))
        for prefix, (generic, templates) in GROUPS.items():
            match = [(n, i) for n, i in groups.items() if n.startswith(prefix)]
            if not match:
                print("  (no enabled ad group %s - skipped)" % prefix)
                continue
            name, ag_id = match[0]
            resource = "customers/%s/adGroups/%s" % (CID, ag_id)
            group_negs = campaign_negs + [
                (r.ad_group_criterion.keyword.text.lower(), r.ad_group_criterion.keyword.match_type.name)
                for r in rows(f"""SELECT ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type
                    FROM ad_group_criterion WHERE ad_group.id = {ag_id} AND ad_group_criterion.type = 'KEYWORD'
                    AND ad_group_criterion.negative = TRUE""")]
            phrases = list(generic) + [t.format(c=c) for c in cities for t in templates]
            for text in phrases:
                if classify(text) == "seeker":
                    problems.append("reads as a seeker: " + text)
                    continue
                if text in in_campaign:
                    print("  skip (exists)   %s" % text)
                    continue
                neg = blocked_by(text, group_negs)
                if neg:
                    print("  skip (negative) %-45s blocked by %s" % (text, neg))
                    continue
                in_campaign.add(text)  # never plan the same text twice in one campaign
                plan.append((resource, "%s / %s" % (camp.split()[0], prefix), text))
    if problems:
        raise SystemExit("not sending anything:\n  " + "\n  ".join(problems))

    print("\nkeywords to add: %d" % len(plan))
    for _, label, text in plan:
        print("  + [%-22s] %s" % (label, text))
    if args.dry_run or not plan:
        print("\n[dry run] %d keyword(s) planned, nothing sent." % len(plan) if plan else "Nothing to do - already in sync.")
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
