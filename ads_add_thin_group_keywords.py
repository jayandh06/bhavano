"""Fills the thin ad groups of the enabled Metro / Other-Metro campaigns with owner-phrased keywords, and adds exact-match
copies of the phrases that already converted.

Why: ads_keyword_coverage.py (2026-11-01) showed Sell Apartment / Villa / Commercial, Lease Commercial, the two Generic Post Ad
Intent groups and the two Rent Out Villa groups with 1-4 keywords each, and every keyword in the account as PHRASE match.
Rules: no word "free" (2.3.7 / the 2026-10-30 decision), every phrase speaks as someone with a property (ads_intent.classify()
must not read it as a seeker), phrases already in the group (any status) or blocked by a negative are skipped, bids / ads /
landing pages untouched. Idempotent.

Run: python ads_add_thin_group_keywords.py --dry-run     read-only, prints exactly what would be added
     python ads_add_thin_group_keywords.py --validate    Google validates the batch, nothing is created
     python ads_add_thin_group_keywords.py               applies it
"""

import argparse
from datetime import date, timedelta

from ads_add_owner_city_keywords import blocked_by
from ads_intent import classify
from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException

CID = "4214066478"

SELL_APT = ["sell my flat online", "sell my apartment online", "list my flat for sale", "list my apartment for sale",
            "post flat for sale", "post apartment for sale", "sell flat without broker", "sell apartment without broker",
            "advertise my flat for sale", "sell my flat directly to buyers", "sell my apartment by owner", "put my flat up for sale"]
SELL_VILLA = ["sell my villa", "sell my villa online", "list my villa for sale", "post villa for sale", "sell villa without broker",
              "advertise my villa for sale", "sell my villa directly to buyers", "sell villa by owner", "sell my independent house online"]
SELL_COMM = ["sell my shop", "sell my office space", "sell my commercial property", "list my commercial property for sale",
             "post commercial property for sale", "sell my warehouse", "sell commercial property without broker",
             "advertise my shop for sale", "sell my showroom", "sell my office without broker"]
LEASE_COMM = ["lease out my shop", "lease out my office", "lease out my commercial property", "list my shop for lease",
              "list my office for lease", "post commercial property for lease", "lease out my warehouse", "lease out my showroom",
              "give my shop on lease", "give my office on lease"]
GENERIC = ["post property ad online", "list my property online", "sell property without broker", "property listing site for owners",
           "where to post property ad", "how to list my property online", "advertise my property online",
           "list property for sale by owner", "post my property for sale or rent", "post property for rent online"]
RENT_VILLA = ["rent out my villa", "rent out my independent house", "list my villa for rent", "post villa for rent",
              "give my villa for rent", "put my house on rent", "let out my villa", "list independent house for rent"]

# ad group id (apps/bff/src/ads/campaign-names.ts) -> (campaign, label, phrases)
GROUPS = {
    "205333958048": ("Metro-Sell Property (Owners/Agents)", "1.2 Sell Apartment", SELL_APT),
    "202583649071": ("Metro-Sell Property (Owners/Agents)", "1.3 Sell Villa", SELL_VILLA),
    "196651916541": ("Metro-Sell Property (Owners/Agents)", "1.5 Sell Commercial", SELL_COMM),
    "200422014173": ("Other-Metro-Sell Property (Owners/Agents)", "1.2 Sell Apartment", SELL_APT),
    "200422014133": ("Other-Metro-Sell Property (Owners/Agents)", "1.5 Sell Commercial", SELL_COMM),
    "198411059486": ("Metro-Lease Property", "3.1 Lease Commercial", LEASE_COMM),
    "198419903663": ("Metro-Generic Post Ad Intent", "Generic Ad group 1", GENERIC),
    "201547741818": ("Other-Metro-Generic Post Ad Intent", "Generic Ad group 1", GENERIC),
    "201241519122": ("Metro-Rent Out Property (Owners)", "2.3 Rent Out Villa", RENT_VILLA),
    "198875640445": ("Other-Metro-Rent Out Property (Owners)", "2.3 Rent Out Villa", RENT_VILLA),
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
    print("Account %s%s\n" % (CID, "   [DRY RUN]" if args.dry_run else "   [VALIDATE ONLY]" if args.validate else ""))

    plan, problems = [], []  # (ad_group_resource, label, text, match_type)
    for ag_id, (campaign, label, phrases) in GROUPS.items():
        found = rows(f"SELECT campaign.name, campaign.id FROM ad_group WHERE ad_group.id = {ag_id}")
        if not found or found[0].campaign.name != campaign:
            raise SystemExit("ad group %s (%s) not found in %s" % (ag_id, label, campaign))
        camp_id = found[0].campaign.id
        resource = "customers/%s/adGroups/%s" % (CID, ag_id)
        existing = {(r.ad_group_criterion.keyword.text.lower(), r.ad_group_criterion.keyword.match_type.name)
                    for r in rows(f"""SELECT ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type FROM ad_group_criterion
                        WHERE ad_group.id = {ag_id} AND ad_group_criterion.type = 'KEYWORD' AND ad_group_criterion.negative = FALSE
                        AND ad_group_criterion.status != 'REMOVED'""")}
        negs = [(r.campaign_criterion.keyword.text.lower(), r.campaign_criterion.keyword.match_type.name)
                for r in rows(f"""SELECT campaign_criterion.keyword.text, campaign_criterion.keyword.match_type FROM campaign_criterion
                    WHERE campaign.id = {camp_id} AND campaign_criterion.type = 'KEYWORD' AND campaign_criterion.negative = TRUE""")]
        negs += [(r.ad_group_criterion.keyword.text.lower(), r.ad_group_criterion.keyword.match_type.name)
                 for r in rows(f"""SELECT ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type FROM ad_group_criterion
                    WHERE ad_group.id = {ag_id} AND ad_group_criterion.type = 'KEYWORD' AND ad_group_criterion.negative = TRUE""")]
        print("%s / %s: %d existing" % (campaign, label, len(existing)))
        for text in phrases:
            if "free" in text.split():
                problems.append("contains free: " + text)
                continue
            if classify(text) == "seeker":
                print("  skip (reads as seeker) %s" % text)
                continue
            if (text, "PHRASE") in existing:
                continue
            neg = blocked_by(text, negs)
            if neg:
                print("  skip (negative) %-40s blocked by %s" % (text, neg))
                continue
            plan.append((resource, "%s / %s" % (campaign[:22], label), text, "PHRASE"))

    # Exact-match copies of the keywords that converted in the last 90 days, in the same enabled-campaign ad group.
    conv = rows("""SELECT ad_group.id, campaign.name, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, metrics.conversions
        FROM keyword_view WHERE segments.date BETWEEN '%s' AND '%s' AND metrics.conversions > 0 AND campaign.status = 'ENABLED'
        AND ad_group.status = 'ENABLED' AND ad_group_criterion.status = 'ENABLED' AND ad_group_criterion.negative = FALSE""" % ((date.today() - timedelta(days=90)).isoformat(), date.today().isoformat()))
    print("\nconverting keywords (90d, enabled campaigns): %d" % len(conv))
    for r in conv:
        text = r.ad_group_criterion.keyword.text.lower()
        if "free" in text.split() or r.ad_group_criterion.keyword.match_type.name != "PHRASE" or classify(text) == "seeker":
            continue
        ag_id = str(r.ad_group.id)
        has = rows(f"""SELECT ad_group_criterion.criterion_id FROM ad_group_criterion WHERE ad_group.id = {ag_id}
            AND ad_group_criterion.type = 'KEYWORD' AND ad_group_criterion.keyword.text = '{text}'
            AND ad_group_criterion.keyword.match_type = 'EXACT' AND ad_group_criterion.status != 'REMOVED'""")
        if not has:
            plan.append(("customers/%s/adGroups/%s" % (CID, ag_id), "%s / exact" % r.campaign.name[:22], text, "EXACT"))
            print("  exact copy: %-40s (%.1f conv)  %s" % (text, r.metrics.conversions, r.campaign.name))

    plan = list(dict.fromkeys(plan))  # a keyword can come back once per ad group row
    if problems:
        raise SystemExit("not sending anything:\n  " + "\n  ".join(problems))
    print("\nkeywords to add: %d" % len(plan))
    for _, label, text, mt in plan:
        print("  + [%-34s] %-6s %s" % (label, mt, text))
    if args.dry_run or not plan:
        print("\n[dry run] nothing sent." if plan else "Nothing to do - already in sync.")
        return

    ops = []
    for resource, _, text, mt in plan:
        op = client.get_type("AdGroupCriterionOperation")
        op.create.ad_group = resource
        op.create.status = enums.AdGroupCriterionStatusEnum.ENABLED
        op.create.keyword.text = text
        op.create.keyword.match_type = getattr(enums.KeywordMatchTypeEnum, mt)
        ops.append(op)
    try:
        client.get_service("AdGroupCriterionService").mutate_ad_group_criteria(
            request={"customer_id": CID, "operations": ops, "validate_only": args.validate})
    except GoogleAdsException as e:
        raise SystemExit("mutate failed:\n%s" % "\n".join("  %s" % er.message for er in e.failure.errors))
    print("\n[validate only] Google accepted all %d operation(s); nothing was created." % len(ops) if args.validate
          else "\napplied %d keyword(s)." % len(ops))


if __name__ == "__main__":
    main()
