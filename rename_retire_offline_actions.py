"""One-off: apply the same treatment "New registration"/"Post ad success" already got to the
remaining 4 purchase conversion actions — Boost purchase, Subscription purchase, Contact reveal
credits purchase, Instant alerts purchase.

For each pair (old dormant WEBPAGE action, new live UPLOAD_CLICKS "(offline)" action):
  1. Rename the old WEBPAGE action "X" -> "X_removed" (frees up the plain name).
  2. Retire it via a `remove` operation (status can't be set to REMOVED via `update` directly).
  3. Rename the "(offline)" action "X (offline)" -> "X" (takes over the plain name).

Targets by conversion action ID (not name — names are literally being changed here, so matching
by name mid-operation is exactly the trap that made ads_retire_dormant_conversion_actions.py's
NAMES_TO_RETIRE list stale for "Post ad success"/"New registration").

Run: python rename_retire_offline_actions.py --dry-run
     python rename_retire_offline_actions.py
"""
import sys

from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException
from google.api_core import protobuf_helpers

CID = "4214066478"
DRY = "--dry-run" in sys.argv

# (old WEBPAGE id, new UPLOAD_CLICKS id, plain name)
PAIRS = [
    ("7735421699", "7781548730", "Boost purchase"),
    ("7735421702", "7781648601", "Subscription purchase"),
    ("7754243275", "7781653126", "Contact reveal credits purchase"),
    ("7781064228", "7781544854", "Instant alerts purchase"),
]


def main():
    client = make_client()
    ga = client.get_service("GoogleAdsService")
    svc = client.get_service("ConversionActionService")

    rows = {
        str(r.conversion_action.id): r.conversion_action
        for r in ga.search(customer_id=CID, query="""
            SELECT conversion_action.id, conversion_action.name, conversion_action.status,
                   conversion_action.resource_name
            FROM conversion_action
        """)
    }

    for old_id, new_id, plain_name in PAIRS:
        old = rows.get(old_id)
        new = rows.get(new_id)
        if not old or not new:
            print("  SKIP   %-32s old=%s new=%s (one or both not found)" % (plain_name, old_id, new_id))
            continue

        print("%s" % plain_name)

        # Step 1+2: rename old to "_removed" and retire, unless already done.
        if old.status.name == "REMOVED":
            print("    ok     old id=%s already REMOVED (name=%r)" % (old_id, old.name))
        else:
            removed_name = plain_name + "_removed"
            if DRY:
                print("    WOULD  rename old id=%s %r -> %r, then retire" % (old_id, old.name, removed_name))
            else:
                rename_op = client.get_type("ConversionActionOperation")
                rename_op.update.resource_name = old.resource_name
                rename_op.update.name = removed_name
                client.copy_from(rename_op.update_mask, protobuf_helpers.field_mask(None, rename_op.update._pb))
                try:
                    svc.mutate_conversion_actions(customer_id=CID, operations=[rename_op])
                    print("    done   renamed old id=%s -> %r" % (old_id, removed_name))
                except GoogleAdsException as e:
                    print("    FAILED rename old id=%s -> %s" % (old_id, e.failure.errors[0].message))
                    continue

                retire_op = client.get_type("ConversionActionOperation")
                retire_op.remove = old.resource_name
                try:
                    svc.mutate_conversion_actions(customer_id=CID, operations=[retire_op])
                    print("    done   retired old id=%s" % old_id)
                except GoogleAdsException as e:
                    print("    FAILED retire old id=%s -> %s" % (old_id, e.failure.errors[0].message))

        # Step 3: rename the offline one to the plain name.
        if new.name == plain_name:
            print("    ok     new id=%s already named %r" % (new_id, plain_name))
        else:
            if DRY:
                print("    WOULD  rename new id=%s %r -> %r" % (new_id, new.name, plain_name))
            else:
                op = client.get_type("ConversionActionOperation")
                op.update.resource_name = new.resource_name
                op.update.name = plain_name
                client.copy_from(op.update_mask, protobuf_helpers.field_mask(None, op.update._pb))
                try:
                    svc.mutate_conversion_actions(customer_id=CID, operations=[op])
                    print("    done   renamed new id=%s -> %r" % (new_id, plain_name))
                except GoogleAdsException as e:
                    print("    FAILED rename new id=%s -> %s" % (new_id, e.failure.errors[0].message))

    if DRY:
        print("\n[dry run] nothing changed.")


if __name__ == "__main__":
    main()
