"""Copies Metro-Rent Out Property (Owners)'s "Ad Group 2.3 — Rent Out Villa/Independent House"
keywords onto the Other-Metro equivalent, which currently has zero keywords (flagged in the
account's own recommendations: "1 ad group does not have any keywords").

Confirmed live (read-only query) before writing this:
- Metro Ad Group 2.3 (adGroups/201241519122): 4 enabled PHRASE keywords — "list bungalow for
  rent", "post independent house for rent", "rent out villa online", "rent out my independent
  house".
- Other-Metro Ad Group 2.3 (adGroups/198875640445): 0 keywords.

Both ad group IDs are the ones already recorded in apps/bff/src/ads/campaign-names.ts. Idempotent:
re-running only adds whatever's still missing by (text, match_type) — never duplicates, never
touches the Metro side.

Run: python ads_copy_keywords_rent_out_villa_other_metro.py --dry-run     read-only, prints the plan
     python ads_copy_keywords_rent_out_villa_other_metro.py --validate    Google validates the batch, nothing created
     python ads_copy_keywords_rent_out_villa_other_metro.py               applies it
"""

import argparse

from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException

CID = "4214066478"
SOURCE_AD_GROUP = "customers/4214066478/adGroups/201241519122"  # Metro — Ad Group 2.3
TARGET_AD_GROUP = "customers/4214066478/adGroups/198875640445"  # Other-Metro — Ad Group 2.3


def fail(what, e):
    errs = e.failure.errors
    raise SystemExit("%s failed:\n%s" % (what, "\n".join(
        "  %s (%s)" % (er.message, er.location.field_path_elements[-1].field_name
                       if er.location.field_path_elements else "-") for er in errs) or e))


def main():
    p = argparse.ArgumentParser()
    mode = p.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true")
    mode.add_argument("--validate", action="store_true")
    args = p.parse_args()

    client = make_client()
    ga = client.get_service("GoogleAdsService")
    agc_svc = client.get_service("AdGroupCriterionService")
    enums = client.enums

    def rows(query):
        return list(ga.search(customer_id=CID, query=query))

    def keywords_in(ad_group):
        found = {}
        for r in rows(
            "SELECT ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, "
            "ad_group_criterion.status FROM ad_group_criterion "
            "WHERE ad_group_criterion.type = 'KEYWORD' AND ad_group_criterion.negative = FALSE "
            "AND ad_group_criterion.status != 'REMOVED' AND ad_group.resource_name = '%s'" % ad_group
        ):
            key = (r.ad_group_criterion.keyword.text.lower(), r.ad_group_criterion.keyword.match_type.name)
            found[key] = r.ad_group_criterion.status.name
        return found

    tag = "   [DRY RUN]" if args.dry_run else "   [VALIDATE ONLY]" if args.validate else ""
    print("Account %s%s\n" % (CID, tag))

    source = keywords_in(SOURCE_AD_GROUP)
    target = keywords_in(TARGET_AD_GROUP)

    print("Source (Metro, Ad Group 2.3): %d keyword(s)" % len(source))
    for (text, match), status in source.items():
        print("  %-45s %-8s %s" % (text, match, status))

    to_add = [(text, match) for (text, match) in source if (text, match) not in target]
    print("\nTarget (Other-Metro, Ad Group 2.3): %d existing, %d to add" % (len(target), len(to_add)))

    if not to_add:
        print("  Nothing to do — already in sync.")
        return

    ops = []
    for text, match in to_add:
        print("  + %-45s %s" % (text, match))
        op = client.get_type("AdGroupCriterionOperation")
        op.create.ad_group = TARGET_AD_GROUP
        op.create.status = enums.AdGroupCriterionStatusEnum.ENABLED
        op.create.keyword.text = text
        op.create.keyword.match_type = getattr(enums.KeywordMatchTypeEnum, match)
        ops.append(op)

    if args.dry_run:
        print("\n[dry run] %d operation(s) planned, nothing sent." % len(ops))
        return

    try:
        agc_svc.mutate_ad_group_criteria(
            request={"customer_id": CID, "operations": ops, "validate_only": args.validate})
    except GoogleAdsException as e:
        fail("Add keywords", e)

    if args.validate:
        print("\n[validate only] Google accepted all %d operation(s); nothing was created." % len(ops))
    else:
        print("\napplied %d keyword(s)." % len(ops))


if __name__ == "__main__":
    main()
