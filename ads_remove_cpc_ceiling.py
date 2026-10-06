"""Removes the CPC bid ceiling from the Bhavano-TargetCPA portfolio bidding strategy.

Plan and reasoning: docs/plans/oct4-cpc-spike-and-target-cpa-ceiling.md. The ₹50 ceiling, added
in response to a ₹1,674 single-click spike on 2026-10-04, was shown to be throttling normal,
well-converting traffic (the keyword responsible for the spike averages ₹46.87/click on its other
99 clicks over 90 days, already above the ceiling) rather than just blocking the rare outlier.
Google explicitly advises against a bid cap on Target CPA for exactly this reason. The ₹75 target
itself is left untouched — that's the real lever, and each campaign's own daily budget
(₹300-900) is the backstop against another one-off expensive click.

`target_cpa.cpc_bid_ceiling_micros` is a presence-tracked ("optional") field, unlike the plain
int64 fields hit by the field-mask gotcha in ads_fix_conversion_goals.py — so leaving it unset in
the update message while explicitly listing its path in the update_mask is the correct way to
clear it (not set it to 0, which would be a literal ₹0 bid limit, not "no limit").

Run: python ads_remove_cpc_ceiling.py --dry-run     read-only, prints the plan
     python ads_remove_cpc_ceiling.py --validate    Google validates, nothing is created
     python ads_remove_cpc_ceiling.py                applies
"""

import argparse

from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException

CID = "4214066478"
STRATEGY_NAME = "Bhavano-TargetCPA"


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

    def rows(query):
        return list(ga.search(customer_id=CID, query=query))

    tag = "   [DRY RUN]" if args.dry_run else "   [VALIDATE ONLY]" if args.validate else ""
    print("Account %s%s\n" % (CID, tag))

    strategies = rows(
        "SELECT bidding_strategy.resource_name, bidding_strategy.name, "
        "bidding_strategy.target_cpa.target_cpa_micros, "
        "bidding_strategy.target_cpa.cpc_bid_ceiling_micros "
        "FROM bidding_strategy WHERE bidding_strategy.name = '%s'" % STRATEGY_NAME
    )
    if not strategies:
        raise SystemExit("Bidding strategy not found: %s" % STRATEGY_NAME)
    s = strategies[0].bidding_strategy
    print("%s: target_cpa=₹%.2f, current ceiling=₹%.2f"
          % (STRATEGY_NAME, s.target_cpa.target_cpa_micros / 1e6,
             s.target_cpa.cpc_bid_ceiling_micros / 1e6))

    if s.target_cpa.cpc_bid_ceiling_micros == 0:
        print("\nok     ceiling already unset. Nothing to do.")
        return

    print("change remove ceiling (₹%.2f -> none); target_cpa stays ₹%.2f"
          % (s.target_cpa.cpc_bid_ceiling_micros / 1e6, s.target_cpa.target_cpa_micros / 1e6))

    if args.dry_run:
        print("\n[dry run] 1 operation planned, nothing sent.")
        return

    op = client.get_type("MutateOperation")
    op.bidding_strategy_operation.update.resource_name = s.resource_name
    # Deliberately never touching op.update.target_cpa.cpc_bid_ceiling_micros: leaving it
    # unset, while listing its path in the mask, is what clears a presence-tracked field —
    # see the module docstring for why this differs from the plain-int64 fields elsewhere.
    op.bidding_strategy_operation.update_mask.paths.append("target_cpa.cpc_bid_ceiling_micros")

    req = client.get_type("MutateGoogleAdsRequest")
    req.customer_id = CID
    req.mutate_operations.append(op)
    req.validate_only = args.validate
    try:
        res = ga.mutate(request=req)
    except GoogleAdsException as e:
        fail("Mutate", e)
    if args.validate:
        print("\n[validate only] Google accepted the operation; nothing was created.")
        return
    print("\napplied %d operation(s)." % len(res.mutate_operation_responses))


if __name__ == "__main__":
    main()
