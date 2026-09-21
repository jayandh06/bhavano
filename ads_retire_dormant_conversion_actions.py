"""Retires dormant, superseded WEBPAGE-type conversion actions, matched by NAME.

STALE WARNING, read before adding a name here: "Post ad success" and "New registration" used to
be the dormant WEBPAGE actions this script targeted. They no longer are — both were manually
renamed to "<name>_removed" (and retired) once their GTM tags were paused in favour of the
"(offline)" UPLOAD_CLICKS actions, which then took over the plain name. If you re-add either name
to NAMES_TO_RETIRE today, this script will happily retire the *live* UPLOAD_CLICKS action instead,
since name lookup can't tell the difference. The same thing later happened to "Boost purchase",
"Subscription purchase", "Contact reveal credits purchase" and "Instant alerts purchase" —
see rename_retire_offline_actions.py, which targets by conversion action ID for exactly this
reason rather than by name.

"Sign-up" is the one name still safely retireable here: a separate, never-wired account-default
action (docs/plans/server-side-google-ads-conversion-upload.md calls it out as unused) with no
"(offline)" successor to collide with.

Uses a `remove` operation (not `update.status = REMOVED` — the API rejects setting REMOVED
directly via update: "Enum value 'REMOVED' cannot be used", learned by trying it). Google Ads
preserves each action's historical reporting data; only new attribution/bidding stops.

Idempotent: an already-REMOVED action is left alone and reported as such, so re-running is safe —
but idempotency only protects against re-running on the SAME target; it does nothing to stop a
future edit from pointing NAMES_TO_RETIRE at a name that has since been reassigned.

Run: python ads_retire_dormant_conversion_actions.py --dry-run
     python ads_retire_dormant_conversion_actions.py
"""

import sys

from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException

CID = "4214066478"
DRY = "--dry-run" in sys.argv

NAMES_TO_RETIRE = ["Sign-up"]


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
