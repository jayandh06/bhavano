"""Fixes two conversion-goal problems found while scoping Target ROAS
(docs/plans/target-roas-value-carrying-campaigns.md):

1. Metro-Seeker Intent is bidding toward the wrong thing. Its own goal, "Save a search"
   (ENGAGEMENT), is non-biddable account-wide (an unintended side effect of
   ads_retarget_owners.py's account-wide ENGAGEMENT toggle, written for the Leads- campaigns).
   Target CPA's official "conversions" for this campaign are entirely "Post ad success" — a
   POSTER action — not anything seeker-side. Fix: give this one campaign its own
   campaign-level conversion goal override (ENGAGEMENT biddable, everything else not), exactly
   what docs/plans/seeker-intent-campaign.md's original pilot sketch asked for but never
   implemented. Also moves it off the shared Bhavano-TargetCPA portfolio onto standalone
   Maximize Conversions with no target — same doc's own bidding plan — since after this fix it
   will have had exactly 1 real conversion ever, nowhere near enough to share a target
   calibrated against poster-campaign costs.

2. PURCHASE is a biddable account-wide goal, inherited by every poster campaign, so real but
   rare Boost-purchase events (1-7 per campaign per 90 days, against each campaign's much larger
   Post-ad-success volume) are diluting their Target CPA signal with noise their real goal
   ("Post ad success") never asked for. Fix: campaign-level override, PURCHASE -> not biddable,
   on every poster campaign. Account-wide PURCHASE stays biddable (a future purchase-focused
   campaign, see the Target ROAS plan, can still use it) — only these specific campaigns opt out.

Everything here is a CampaignConversionGoal override (biddable=True/False for one category on
one campaign) or, for Metro-Seeker Intent only, a campaign-level bidding-strategy switch — never
an account-wide change. All ops go in ONE GoogleAdsService.mutate, so --validate checks the
whole change end to end and a real run either fully applies or not at all.

Run: python ads_fix_conversion_goals.py --dry-run     read-only, prints the plan
     python ads_fix_conversion_goals.py --validate    Google validates, nothing is created
     python ads_fix_conversion_goals.py                applies
"""

import argparse

from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException

CID = "4214066478"
SEEKER_CAMPAIGN = "Metro-Seeker Intent"

# Every poster-side campaign (incl. the paused Leads- pair) that should stop bidding toward
# PURCHASE — "Post ad success"/"New registration" is each one's real, stated goal.
POSTER_CAMPAIGNS = [
    "Metro-Generic Post Ad Intent",
    "Metro-Lease Property",
    "Metro-Rent Out Property (Owners)",
    "Metro-Sell Property (Owners/Agents)",
    "Other-Metro-Generic Post Ad Intent",
    "Other-Metro-Lease Property",
    "Other-Metro-Rent Out Property (Owners)",
    "Other-Metro-Sell Property (Owners/Agents)",
    "Leads-Search-1",
    "Leads-Performance Max-1",
]

# Metro-Seeker Intent's corrected goal set: ENGAGEMENT (Save a search) is the only thing it
# should bid toward. Leaving PAGE_VIEW/CONTACT alone — both already non-biddable account-wide
# and not part of this fix.
SEEKER_GOALS = {
    "ENGAGEMENT": True,
    "PURCHASE": False,
    "SIGNUP": False,
    "SUBMIT_LEAD_FORM": False,
    "PHONE_CALL_LEAD": False,
}


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

    campaigns = {r.campaign.name: r.campaign.resource_name for r in rows(
        "SELECT campaign.name, campaign.resource_name FROM campaign "
        "WHERE campaign.status != 'REMOVED'")}

    tag = "   [DRY RUN]" if args.dry_run else "   [VALIDATE ONLY]" if args.validate else ""
    print("Account %s%s\n" % (CID, tag))
    ops = []

    # --- 1. Metro-Seeker Intent's own goal set ---------------------------------------------
    print("Metro-Seeker Intent goal set")
    if SEEKER_CAMPAIGN not in campaigns:
        raise SystemExit("Campaign not found: %s" % SEEKER_CAMPAIGN)
    goal_rows = {r.campaign_conversion_goal.category.name: r for r in rows(
        "SELECT campaign_conversion_goal.resource_name, campaign_conversion_goal.category, "
        "campaign_conversion_goal.biddable FROM campaign_conversion_goal "
        "WHERE campaign.name = '%s'" % SEEKER_CAMPAIGN)}
    for category, want in SEEKER_GOALS.items():
        r = goal_rows.get(category)
        if r is None:
            print("  SKIP   %-16s not found for this campaign" % category)
            continue
        have = r.campaign_conversion_goal.biddable
        if have == want:
            print("  ok     %-16s already biddable=%s" % (category, want))
            continue
        print("  change %-16s biddable %s -> %s" % (category, have, want))
        op = client.get_type("MutateOperation")
        op.campaign_conversion_goal_operation.update.resource_name = (
            r.campaign_conversion_goal.resource_name)
        op.campaign_conversion_goal_operation.update.biddable = want
        # Explicit path, not protobuf_helpers.field_mask(None, ...): that helper derives the
        # mask by diffing against an all-default message, so `biddable = False` (proto3's
        # zero value) is indistinguishable from "never touched" and gets silently dropped —
        # the mutate then reports success while changing nothing. Same class of account gotcha
        # ads_retarget_owners.py already hit with primary_for_goal = False.
        op.campaign_conversion_goal_operation.update_mask.paths.append("biddable")
        ops.append(op)

    # --- 2. Metro-Seeker Intent's bidding strategy: off the shared portfolio ---------------
    print("\nMetro-Seeker Intent bidding strategy")
    for r in rows(
        "SELECT campaign.resource_name, campaign.bidding_strategy, campaign.bidding_strategy_type "
        "FROM campaign WHERE campaign.name = '%s'" % SEEKER_CAMPAIGN
    ):
        if r.campaign.bidding_strategy_type.name == "MAXIMIZE_CONVERSIONS" and not r.campaign.bidding_strategy:
            print("  ok     already standalone Maximize Conversions")
            continue
        print("  change %s (shared portfolio) -> standalone Maximize Conversions, no target"
              % r.campaign.bidding_strategy_type.name)
        op = client.get_type("MutateOperation")
        op.campaign_operation.update.resource_name = r.campaign.resource_name
        op.campaign_operation.update.maximize_conversions = client.get_type("MaximizeConversions")
        # The mask must name the leaf field, not the message itself ("field mask updated a
        # field with subfields"). target_cpa_micros left at 0 (its proto3 default) is the
        # correct way to request "no target" — MaximizeConversions' own field doc: "If the
        # target CPA is not set, the bid strategy will aim to achieve the lowest possible CPA."
        op.campaign_operation.update_mask.paths.append("maximize_conversions.target_cpa_micros")
        ops.append(op)

    # --- 3. Poster campaigns: stop bidding toward PURCHASE ---------------------------------
    print("\nPoster campaigns: PURCHASE -> not biddable")
    purchase_rows = {r.campaign.name: r for r in rows(
        "SELECT campaign.name, campaign_conversion_goal.resource_name, "
        "campaign_conversion_goal.biddable FROM campaign_conversion_goal "
        "WHERE campaign_conversion_goal.category = 'PURCHASE'")}
    for name in POSTER_CAMPAIGNS:
        if name not in campaigns:
            print("  SKIP   %-42s campaign not found" % name)
            continue
        r = purchase_rows.get(name)
        if r is None:
            print("  SKIP   %-42s no PURCHASE goal row" % name)
            continue
        if not r.campaign_conversion_goal.biddable:
            print("  ok     %-42s PURCHASE already not biddable" % name)
            continue
        print("  change %-42s PURCHASE biddable True -> False" % name)
        op = client.get_type("MutateOperation")
        op.campaign_conversion_goal_operation.update.resource_name = (
            r.campaign_conversion_goal.resource_name)
        op.campaign_conversion_goal_operation.update.biddable = False
        op.campaign_conversion_goal_operation.update_mask.paths.append("biddable")
        ops.append(op)

    if not ops:
        print("\nNothing to do.")
        return
    if args.dry_run:
        print("\n[dry run] %d operation(s) planned, nothing sent." % len(ops))
        return

    req = client.get_type("MutateGoogleAdsRequest")
    req.customer_id = CID
    req.mutate_operations.extend(ops)
    req.validate_only = args.validate
    try:
        res = ga.mutate(request=req)
    except GoogleAdsException as e:
        fail("Mutate", e)
    if args.validate:
        print("\n[validate only] Google accepted all %d operation(s); nothing was created." % len(ops))
        return
    print("\napplied %d operation(s)." % len(res.mutate_operation_responses))


if __name__ == "__main__":
    main()
