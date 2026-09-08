"""Retires the dormant, superseded WEBPAGE-type conversion actions: "Sign-up", "Post ad success",
"New registration". Uses a `remove` operation (not `update.status = REMOVED` — the API rejects
setting REMOVED directly via update: "Enum value 'REMOVED' cannot be used", learned by trying it).
Google Ads preserves each action's historical reporting data; only new attribution/bidding stops.

Why these three and not others: "Post ad success"/"New registration" had their GTM tags
deliberately paused when tracking moved server-side to the "(offline)" UPLOAD_CLICKS actions (see
docs/plans/server-side-google-ads-conversion-upload.md, which already flagged full retirement —
status: REMOVED — as "a fine future cleanup"). "Sign-up" is a separate, never-wired account-default
action the same doc calls out as unused. All three currently show 0 conversions and
"Needs attention"/"Misconfigured" while still primary_for_goal=true, so they count toward
Maximise-Conversions bidding goals despite contributing nothing.

Explicitly NOT touched: "Boost purchase", "Subscription purchase", "Save a search" — those are
correctly wired (tags live, event names match, code reachable) and simply have zero real usage
yet, not a defect — retiring them would be wrong, not a cleanup.

Idempotent: an already-REMOVED action is left alone and reported as such, so re-running is safe.

Run: python ads_retire_dormant_conversion_actions.py --dry-run
     python ads_retire_dormant_conversion_actions.py
"""

import sys

from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException

CID = "4214066478"
DRY = "--dry-run" in sys.argv

NAMES_TO_RETIRE = ["Sign-up", "Post ad success", "New registration"]


def main():
    client = make_client()
    ga = client.get_service("GoogleAdsService")
    conv_action_svc = client.get_service("ConversionActionService")

    rows = {
        r.conversion_action.name: r.conversion_action
        for r in ga.search(customer_id=CID, query="""
            SELECT conversion_action.id, conversion_action.name, conversion_action.status,
                   conversion_action.resource_name
            FROM conversion_action
        """)
    }

    for name in NAMES_TO_RETIRE:
        ca = rows.get(name)
        if not ca:
            print("  SKIP   %-20s not found in account" % name)
            continue
        if ca.status.name == "REMOVED":
            print("  ok     %-20s already REMOVED (id=%s)" % (name, ca.id))
            continue

        if DRY:
            print("  WOULD  retire %-20s id=%s status=%s -> REMOVED" % (name, ca.id, ca.status.name))
            continue

        op = client.get_type("ConversionActionOperation")
        op.remove = ca.resource_name

        try:
            res = conv_action_svc.mutate_conversion_actions(customer_id=CID, operations=[op])
            print("  done   retired %-20s -> %s" % (name, res.results[0].resource_name))
        except GoogleAdsException as e:
            msg = e.failure.errors[0].message if e.failure.errors else str(e)
            print("  FAILED retire %-20s -> %s" % (name, msg))


if __name__ == "__main__":
    main()
