"""Turns AI Max for Search off on the enabled campaigns where it is on.

Why (docs/plans/google-ads-keyword-audit-2026-10.md, "AI Max, 2026-10-27"): AI Max was on for the owner campaigns, Metro-Lease and Metro-Seeker (not set by us on purpose). Its measurable contribution in the last 30 days was tiny:
owner campaigns 33 impressions, 2 clicks, Rs 23, 0 conversions (search term match source AI_MAX_KEYWORDLESS / AI_MAX_BROAD_MATCH); seekers 8 clicks, Rs 247, 0 conversions. Keyword-matched traffic made 156 conversions at Rs 165.
Its other parts (automatic headline rewriting, which can reintroduce claims such as "verified", and final URL expansion, which breaks the per-ad-group landing card and tracking) carry risk we do not want. The owner said to turn it off if it proves not useful.

Only flips campaign.ai_max_setting.enable_ai_max; budgets, bidding, keywords and ads are untouched. Paused campaigns are left alone.

Run: python ads_turn_off_ai_max.py --dry-run     read-only, lists the campaigns
     python ads_turn_off_ai_max.py --validate    Google validates, nothing changes
     python ads_turn_off_ai_max.py               turns it off
     python ads_turn_off_ai_max.py --rollback    turns it back on for the same campaigns
"""

import argparse

from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException

CID = "4214066478"


def main():
    ap = argparse.ArgumentParser()
    mode = ap.add_mutually_exclusive_group()
    for m in ("dry-run", "validate", "rollback"):
        mode.add_argument("--" + m, action="store_true")
    args = ap.parse_args()
    client = make_client()
    ga = client.get_service("GoogleAdsService")

    want_on = args.rollback  # rollback turns it back on
    rows = [(r.campaign.name, r.campaign.resource_name, r.campaign.ai_max_setting.enable_ai_max) for r in ga.search(customer_id=CID, query="""
        SELECT campaign.name, campaign.resource_name, campaign.status, campaign.ai_max_setting.enable_ai_max FROM campaign
        WHERE campaign.status = 'ENABLED'""")]
    todo = [(n, res) for n, res, on in rows if on != want_on and (not want_on or n in ROLLBACK_SET or True)]
    if want_on:
        # only the campaigns this script turned off: the enabled ones that are off now, except the one created off (Other-Metro-Seeker Intent)
        todo = [(n, res) for n, res in todo if n != "Other-Metro-Seeker Intent"]
    for n, _ in todo:
        print("%s AI Max: %s" % ("turn ON " if want_on else "turn OFF", n))
    print("campaigns to change: %d (enabled campaigns already in the wanted state: %d)" % (len(todo), len(rows) - len(todo)))
    if args.dry_run or not todo:
        return
    ops = []
    for _, res in todo:
        op = client.get_type("MutateOperation")
        c = op.campaign_operation.update
        c.resource_name = res
        c.ai_max_setting.enable_ai_max = want_on
        op.campaign_operation.update_mask.paths.append("ai_max_setting.enable_ai_max")
        ops.append(op)
    request = client.get_type("MutateGoogleAdsRequest")
    request.customer_id = CID
    request.mutate_operations.extend(ops)
    request.validate_only = args.validate
    try:
        ga.mutate(request=request)
    except GoogleAdsException as e:
        raise SystemExit("mutate failed:\n%s" % "\n".join("  " + er.message for er in e.failure.errors))
    print("validated only - nothing changed (%d operations)" % len(ops) if args.validate else "done: %d operations" % len(ops))


ROLLBACK_SET = set()

if __name__ == "__main__":
    main()
