"""Creates the two UPLOAD_CLICKS conversion actions the Data Manager API upload targets.

Part B of docs/plans/server-side-google-ads-conversion-upload.md. The existing "New
registration"/"Post ad success" actions are type WEBPAGE (tag-based) — type is fixed at
creation, so they can't be repurposed for events:ingest, which requires productDestinationId to
be a conversion action with type UPLOAD_CLICKS ("Website (Import from clicks)" in the UI).

The old WEBPAGE actions are left alone — once their GTM tags are paused (gtm_disable_ads_tags.py)
they simply stop receiving new hits, so there's no double-counting risk from leaving them in
place. See the plan doc for why that's an acceptable, non-blocking state rather than something
this script also needs to clean up.

Idempotent: an existing conversion action with the same name is left alone and its id read back,
so re-running is safe and is also the way to just fetch the ids.

Run: python ads_create_offline_conversion_actions.py --dry-run
     python ads_create_offline_conversion_actions.py
"""

import sys

from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException
from google.api_core import protobuf_helpers

CID = "4214066478"
DRY = "--dry-run" in sys.argv

# name -> category
ACTIONS = [
    ("New registration (offline)", "SIGNUP"),
    ("Post ad success (offline)", "SUBMIT_LEAD_FORM"),
]


def main():
    client = make_client()
    ga = client.get_service("GoogleAdsService")
    conv_action_svc = client.get_service("ConversionActionService")

    existing = {
        r.conversion_action.name: r.conversion_action.resource_name
        for r in ga.search(customer_id=CID, query="""
            SELECT conversion_action.name, conversion_action.resource_name
            FROM conversion_action
        """)
    }

    for name, category in ACTIONS:
        if name in existing:
            print("  ok     %-30s already exists -> %s" % (name, existing[name]))
            continue

        if DRY:
            print("  WOULD  create %-30s category=%s type=UPLOAD_CLICKS" % (name, category))
            continue

        op = client.get_type("ConversionActionOperation")
        op.create.name = name
        op.create.type_ = client.enums.ConversionActionTypeEnum.UPLOAD_CLICKS
        op.create.category = getattr(client.enums.ConversionActionCategoryEnum, category)
        op.create.status = client.enums.ConversionActionStatusEnum.ENABLED
        op.create.counting_type = client.enums.ConversionActionCountingTypeEnum.ONE_PER_CLICK
        op.create.value_settings.always_use_default_value = True
        op.create.value_settings.default_value = 0.0

        try:
            res = conv_action_svc.mutate_conversion_actions(customer_id=CID, operations=[op])
            rn = res.results[0].resource_name
            print("  done   created %-30s -> %s" % (name, rn))
        except GoogleAdsException as e:
            msg = e.failure.errors[0].message if e.failure.errors else str(e)
            print("  FAILED create %-30s -> %s" % (name, msg))


if __name__ == "__main__":
    main()
