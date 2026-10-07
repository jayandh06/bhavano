"""Drops "Calls" as a biddable conversion goal — account-wide, plus an explicit per-campaign
override on every campaign currently inheriting it. The account has a real conversion action,
"Calls from ads" (AD_CALL, category PHONE_CALL_LEAD, origin CALL_FROM_ADS) — Google auto-creates
this the moment PHONE_CALL_LEAD is a biddable goal, whether or not any campaign actually has a
Call asset. None of this account's campaigns do, which is exactly why every one of them is
flagged "You have a call goal without a call asset" — the goal is biddable, but there is no asset
that could ever generate a call for it to count. Confirmed zero volume ever (ads_conversion_health
.py's 30-day stats have no "Calls from ads" row at all).

Decision: calls aren't a meaningful conversion for this account's funnel (Bhavano's path is
click -> browse -> message/contact on-site, not phone calls), so the fix is to stop bidding
toward it rather than add a Call asset to generate the pre-requisite for a goal nobody wants.
The conversion action itself is left alone (still recorded, in case a future campaign wants it;
see ads_retire_dormant_conversion_actions.py for actually removing a dormant action, a separate,
more final decision not made here) — only the goal's biddable flag changes.

Confirmed before writing this (read-only queries, see docs/plans next to this file's git history
if that doc exists):
- Account-level customer_conversion_goal: PHONE_CALL_LEAD / CALL_FROM_ADS, biddable=True.
- Per-campaign campaign_conversion_goal, category=PHONE_CALL_LEAD: True on every ENABLED campaign
  except Metro-Seeker Intent (already False, from ads_fix_conversion_goals.py's earlier,
  unrelated fix) — i.e. every live campaign is currently inheriting the account default.

Mirrors ads_retarget_owners.py's account-level toggle (CustomerConversionGoalService,
called directly — not part of the batched campaign-level mutate below, since
CustomerConversionGoalOperation is not a MutateOperation oneof member) and
ads_fix_conversion_goals.py's per-campaign override pattern. Both the account-level and
campaign-level updates use an EXPLICIT update_mask path ("biddable"), not
protobuf_helpers.field_mask(None, ...) — see ads_fix_conversion_goals.py's own comment on why
that helper silently drops a False value (indistinguishable from "never touched" when diffed
against an all-default message).

Run: python ads_disable_call_goal.py --dry-run     read-only, prints the plan
     python ads_disable_call_goal.py --validate    Google validates the campaign-level batch,
                                                     nothing is created (the account-level call
                                                     is skipped in this mode — CustomerConversion
                                                     GoalService has no validate_only option)
     python ads_disable_call_goal.py                applies both
"""

import argparse

from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException

CID = "4214066478"
CATEGORY = "PHONE_CALL_LEAD"


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

    # --- 1. Account-level default -----------------------------------------------------------
    print("Account-level %s goal" % CATEGORY)
    customer_goal = None
    for r in rows(
        "SELECT customer_conversion_goal.resource_name, customer_conversion_goal.biddable "
        "FROM customer_conversion_goal "
        "WHERE customer_conversion_goal.category = '%s'" % CATEGORY
    ):
        customer_goal = r.customer_conversion_goal
    if customer_goal is None:
        print("  SKIP   no account-level %s goal row found" % CATEGORY)
    elif not customer_goal.biddable:
        print("  ok     already non-biddable")
    else:
        print("  change biddable True -> False")
        if args.dry_run:
            print("  [dry run] would call CustomerConversionGoalService.mutate_customer_conversion_goals")
        else:
            svc = client.get_service("CustomerConversionGoalService")
            op = client.get_type("CustomerConversionGoalOperation")
            op.update.resource_name = customer_goal.resource_name
            op.update.biddable = False
            op.update_mask.paths.append("biddable")
            if args.validate:
                print("  [validate only] CustomerConversionGoalService has no validate_only option — skipped")
            else:
                try:
                    svc.mutate_customer_conversion_goals(customer_id=CID, operations=[op])
                except GoogleAdsException as e:
                    fail("Account-level mutate", e)
                print("  applied")

    # --- 2. Explicit override on every campaign currently inheriting biddable=True ----------
    print("\nPer-campaign %s overrides" % CATEGORY)
    ops = []
    for r in rows(
        "SELECT campaign.name, campaign.status, campaign_conversion_goal.resource_name, "
        "campaign_conversion_goal.biddable FROM campaign_conversion_goal "
        "WHERE campaign_conversion_goal.category = '%s'" % CATEGORY
    ):
        name = r.campaign.name
        if r.campaign.status.name == "REMOVED":
            continue
        if not r.campaign_conversion_goal.biddable:
            print("  ok     %-45s already non-biddable" % name)
            continue
        print("  change %-45s biddable True -> False" % name)
        op = client.get_type("MutateOperation")
        op.campaign_conversion_goal_operation.update.resource_name = (
            r.campaign_conversion_goal.resource_name)
        op.campaign_conversion_goal_operation.update.biddable = False
        op.campaign_conversion_goal_operation.update_mask.paths.append("biddable")
        ops.append(op)

    if not ops:
        print("  Nothing to do.")
    elif args.dry_run:
        print("\n[dry run] %d campaign-level operation(s) planned, nothing sent." % len(ops))
    else:
        req = client.get_type("MutateGoogleAdsRequest")
        req.customer_id = CID
        req.mutate_operations.extend(ops)
        req.validate_only = args.validate
        try:
            res = ga.mutate(request=req)
        except GoogleAdsException as e:
            fail("Campaign-level mutate", e)
        if args.validate:
            print("\n[validate only] Google accepted all %d operation(s); nothing was created." % len(ops))
        else:
            print("\napplied %d campaign-level operation(s)." % len(res.mutate_operation_responses))


if __name__ == "__main__":
    main()
