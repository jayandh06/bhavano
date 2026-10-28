"""Makes the PURCHASE / WEBSITE conversion goal count (biddable) in the enabled owner campaigns, so "Boost purchase" sales show in Conv. value.

Why (docs/plans/google-ads-keyword-audit-2026-10.md, "Conversion value, 2026-10-28"): the owner campaigns override the account's goals and count only SIGN-UP and SUBMIT_LEAD_FORM as goals, with PURCHASE / WEBSITE switched
off. "Boost purchase" is the only action with a real value (64 purchases, Rs 11,479 in 30 days) and, because its goal is off, nearly all of it landed in "All conv. value" and only Rs 1,457 in "Conv. value".
This turns the goal on for the owner campaigns so Conv. value = the sales made on bhavano.com. Bidding stays on the same strategy (target CPA); the only change to what it counts is that a purchase now also counts as a conversion.
Seeker campaigns are left alone (a seeker does not buy a boost). Paused campaigns are left alone.

Run: python ads_purchase_goal_biddable.py --dry-run     read-only, lists the campaigns it would change
     python ads_purchase_goal_biddable.py --validate    Google validates, nothing changes
     python ads_purchase_goal_biddable.py               applies, after writing a backup of exactly what it changes
     python ads_purchase_goal_biddable.py --rollback    switches the same goals back off, from that backup
"""

import argparse
import json
import os

from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException

CID = "4214066478"
BACKUP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ads_purchase_goal_biddable_backup.json")


def main():
    ap = argparse.ArgumentParser()
    mode = ap.add_mutually_exclusive_group()
    for m in ("dry-run", "validate", "rollback"):
        mode.add_argument("--" + m, action="store_true")
    args = ap.parse_args()
    client = make_client()
    ga = client.get_service("GoogleAdsService")
    svc = client.get_service("CampaignConversionGoalService")

    if args.rollback:
        todo = json.load(open(BACKUP, encoding="utf8"))
        want = False
    else:
        todo = []
        for r in ga.search(customer_id=CID, query="""
            SELECT campaign.name, campaign.status, campaign_conversion_goal.resource_name, campaign_conversion_goal.category,
                   campaign_conversion_goal.origin, campaign_conversion_goal.biddable
            FROM campaign_conversion_goal WHERE campaign.status = 'ENABLED'"""):
            g = r.campaign_conversion_goal
            if g.category.name == "PURCHASE" and g.origin.name == "WEBSITE" and not g.biddable and "seeker" not in r.campaign.name.lower():
                todo.append({"campaign": r.campaign.name, "resource_name": g.resource_name})
        want = True

    for t in todo:
        print("%s PURCHASE/WEBSITE goal: %s" % ("switch ON " if want else "switch OFF", t["campaign"].encode("ascii", "replace").decode()))
    print("goals to change: %d" % len(todo))
    if args.dry_run or not todo:
        return

    if want and not args.validate:
        json.dump(todo, open(BACKUP, "w", encoding="utf8"), indent=2)
        print("backup written: %s" % BACKUP)

    ops = []
    for t in todo:
        op = client.get_type("CampaignConversionGoalOperation")
        op.update.resource_name = t["resource_name"]
        op.update.biddable = want
        op.update_mask.paths.append("biddable")
        ops.append(op)
    try:
        request = client.get_type("MutateCampaignConversionGoalsRequest")
        request.customer_id = CID
        request.operations.extend(ops)
        request.validate_only = args.validate
        svc.mutate_campaign_conversion_goals(request=request)
    except GoogleAdsException as e:
        raise SystemExit("mutate failed:\n%s" % "\n".join("  " + er.message for er in e.failure.errors))
    print("validated only - nothing changed (%d operations)" % len(ops) if args.validate else "done: %d operations" % len(ops))


if __name__ == "__main__":
    main()
