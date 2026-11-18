"""Adds owner-phrased SELL keywords (generic, and city-named) to the Metro-Sell and Other-Metro-Sell ad groups.

Why: "sell my house btm layout bangalore" showed no Bhavano ad. Ad Group 1.1 only had "sell my house online" (phrase match keeps word
order, so a query without "online" is at best a weak match), and the city-named owner keywords added on 2026-10-22 covered the Rent Out
campaign only. A plain "sell my house" phrase also catches every locality search ("sell my house btm layout bangalore"); the
city-named ones give the ad something to echo.

Generic: "sell my house", "sell my flat", "sell my plot"... (no location). City-named: "sell my house in bengaluru" for the cities each
campaign actually targets today (see docs/plans/serve-only-ad-targeted-cities.md; Other-Metro-Sell targets 5 cities since 2026-09-30).

Safety: a phrase that ads_intent.classify() reads as "seeker" is never sent; a phrase already in the campaign (any ad group, any status,
any match type) or blocked by a campaign / ad-group negative is skipped. PHRASE match like the rest of the campaign. No "free" (those
keywords were paused on purpose). Bids, ads and landing pages are untouched. Idempotent.

Run: python ads_add_owner_sell_keywords.py --dry-run     read-only, prints exactly what would be added
     python ads_add_owner_sell_keywords.py --validate    Google validates the batch, nothing is created
     python ads_add_owner_sell_keywords.py               applies it
"""

import argparse

from ads_add_owner_city_keywords import blocked_by
from ads_intent import classify
from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException

CID = "4214066478"

# "bengaluru" and "bangalore" are both typed; Delhi NCR towns are targeted too (Metro-Sell geo targets, 2026-11-18)
CAMPAIGNS = {
    "Metro-Sell Property (Owners/Agents)": [
        "bengaluru", "bangalore", "hyderabad", "chennai", "mumbai", "delhi", "pune", "gurgaon", "noida"],
    "Other-Metro-Sell Property (Owners/Agents)": [
        "ahmedabad", "jaipur", "coimbatore", "lucknow", "kolkata"],
}

# ad group name prefix -> (generic phrases, city templates; {c} is the city)
GROUPS = {
    "Ad Group 1.1": (
        ["sell my house", "sell my home", "sell my property", "list my house for sale", "list my property for sale",
         "advertise my house for sale", "advertise my property for sale", "sell my house without broker",
         "sell my house directly to buyers", "sell my house by owner", "put my house up for sale"],
        ["sell my house in {c}", "sell my property in {c}", "sell my home in {c}", "list my house for sale in {c}",
         "list my property for sale in {c}"]),
    "Ad Group 1.2": (
        ["sell my flat", "sell my apartment", "sell my flat without broker", "sell my apartment without broker",
         "sell my flat by owner", "list my flat for sale online", "sell my 2bhk flat", "sell my 3bhk flat"],
        ["sell my flat in {c}", "sell my apartment in {c}", "list my flat for sale in {c}"]),
    "Ad Group 1.3": (
        ["sell my independent house", "sell my villa by owner", "list my independent house for sale",
         "sell my independent house without broker"],
        ["sell my villa in {c}", "sell my independent house in {c}"]),
    "Ad Group 1.4": (
        ["sell my plot", "sell my land", "sell my site", "list my plot for sale", "list my land for sale",
         "sell my plot without broker", "sell my land without broker", "advertise my land for sale",
         "sell my agricultural land"],
        ["sell my plot in {c}", "sell my land in {c}", "list my plot for sale in {c}"]),
    "Ad Group 1.5": (
        ["sell my office", "sell my commercial space", "list my shop for sale", "list my office for sale",
         "sell my shop without broker"],
        ["sell my shop in {c}", "sell my office in {c}", "sell my commercial property in {c}"]),
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
