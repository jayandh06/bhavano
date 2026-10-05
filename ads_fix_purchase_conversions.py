"""Fixes the purchase conversion actions flagged on Google Ads -> Goals -> Conversions.

docs/plans/google-ads-conversion-goals-cleanup-2026-10.md:
  1. Removes "Instant alerts purchase" — no longer sold on its own (folded into every Boost).
  2. Sets counting to MANY_PER_CLICK ("Every") on the remaining purchase actions; they were
     created ONE_PER_CLICK, the lead setting, so a second purchase from the same ad click was lost.

Targets by conversion action ID, not name — see ads_retire_dormant_conversion_actions.py for how
name matching retired the wrong action before. Idempotent: already-removed / already-MANY_PER_CLICK
actions are reported and left alone.

Run: python ads_fix_purchase_conversions.py --dry-run
     python ads_fix_purchase_conversions.py
"""

import sys

from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException
from google.api_core import protobuf_helpers

CID = "4214066478"
DRY = "--dry-run" in sys.argv

REMOVE_IDS = {"7781544854": "Instant alerts purchase"}
COUNT_EVERY_IDS = {
    "7781548730": "Boost purchase",
    "7781648601": "Subscription purchase",
    "7781653126": "Contact reveal credits purchase",
}


def main():
    client = make_client()
    ga = client.get_service("GoogleAdsService")
    svc = client.get_service("ConversionActionService")

    ids = ", ".join(list(REMOVE_IDS) + list(COUNT_EVERY_IDS))
    rows = {
        str(r.conversion_action.id): r.conversion_action
        for r in ga.search(customer_id=CID, query="""
            SELECT conversion_action.id, conversion_action.name, conversion_action.status,
                   conversion_action.counting_type, conversion_action.resource_name
            FROM conversion_action
            WHERE conversion_action.id IN (%s)
        """ % ids)
    }

    def run(op, label):
        if DRY:
            print("  WOULD  %s" % label)
            return
        try:
            svc.mutate_conversion_actions(customer_id=CID, operations=[op])
            print("  done   %s" % label)
        except GoogleAdsException as e:
            print("  FAILED %s -> %s" % (label, e.failure.errors[0].message if e.failure.errors else e))

    for cid, expected in REMOVE_IDS.items():
        ca = rows.get(cid)
        if not ca:
            print("  SKIP   %s (id=%s) not found" % (expected, cid))
            continue
        if ca.name != expected:
            print("  SKIP   id=%s is named %r, expected %r — not touching it" % (cid, ca.name, expected))
            continue
        if ca.status.name == "REMOVED":
            print("  ok     %s already REMOVED" % ca.name)
            continue
        op = client.get_type("ConversionActionOperation")
        op.remove = ca.resource_name
        run(op, "remove %s (id=%s)" % (ca.name, cid))

    for cid, expected in COUNT_EVERY_IDS.items():
        ca = rows.get(cid)
        if not ca:
            print("  SKIP   %s (id=%s) not found" % (expected, cid))
            continue
        if ca.name != expected:
            print("  SKIP   id=%s is named %r, expected %r — not touching it" % (cid, ca.name, expected))
            continue
        if ca.counting_type.name == "MANY_PER_CLICK":
            print("  ok     %s already counts every conversion" % ca.name)
            continue
        op = client.get_type("ConversionActionOperation")
        op.update.resource_name = ca.resource_name
        op.update.counting_type = client.enums.ConversionActionCountingTypeEnum.MANY_PER_CLICK
        client.copy_from(op.update_mask, protobuf_helpers.field_mask(None, op.update._pb))
        run(op, "%s counting %s -> MANY_PER_CLICK" % (ca.name, ca.counting_type.name))


if __name__ == "__main__":
    main()
