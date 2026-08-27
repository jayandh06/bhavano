"""Builds out container GTM-N46D868W — steps 3 and 4.1 of
docs/plans/consolidate-analytics-and-ads-on-gtm.md.

Creates, in the Default Workspace:
  - 10 Data Layer Variables for the payload keys the app already pushes
  - 8 Custom Event triggers, one per dataLayer event
  - 1 Conversion Linker tag (required for gclid attribution on the GTM path)
  - 8 GA4 Event tags -> G-XZ2TDGSKMS, carrying each event's payload as event parameters

Deliberately NOT done here:
  - Publishing. Everything lands in the workspace; review in GTM Preview, then publish.
  - Deleting the junk "Bhavano-GA4-Tag" event tag (see the plan's findings log) — removal is
    the one irreversible-ish action, left as an explicit human decision.
  - The 5 Google Ads conversion tags — they need per-action conversion labels that do not
    exist yet. Fill ADS_CONVERSION_LABELS and re-run to add them.

Idempotent: anything whose name already exists is skipped, so re-running is safe.

Run: python gtm_build.py --dry-run     (print the plan, change nothing)
     python gtm_build.py               (apply)
"""

import sys

import gtm_api

GA4_MEASUREMENT_ID = "G-XZ2TDGSKMS"  # verified by ga4_audit.py: property bhavano-23f72
ADS_CONVERSION_ID = "AW-18351718445"

# GTM's reserved built-in trigger ids, confirmed present on this container's existing tags.
TRIGGER_ALL_PAGES = "2147479553"

# Payload keys pushed by apps/web/src/lib/gtm.ts callers -> one Data Layer Variable each.
DLV_KEYS = [
    "value",
    "currency",
    "transactionId",
    "listingId",
    "method",
    "category",
    "transactionType",
    "tier",
    "months",
    "boostDays",
]

# event name -> payload keys carried into GA4 as event parameters.
EVENTS = {
    "post_ad_success": ["listingId"],
    "boost_purchase": ["transactionId", "listingId", "category", "boostDays", "value", "currency"],
    "begin_checkout_boost": ["transactionId", "listingId", "category", "boostDays", "value", "currency"],
    "subscription_purchase": ["transactionId", "tier", "months", "value", "currency"],
    "begin_checkout_subscription": ["transactionId", "tier", "months", "value", "currency"],
    "signup_complete": ["method"],
    "save_search": ["category", "transactionType"],
    "contact_owner": ["listingId"],
}

# Fill from Google Ads once the conversion actions exist, then re-run. Event -> label.
ADS_CONVERSION_LABELS = {
    # "boost_purchase": "AbC-D1efGhIjKlmNoP",
    # "subscription_purchase": "...",
    # "post_ad_success": "...",
    # "signup_complete": "...",
    # "save_search": "...",
}
ADS_VALUE_EVENTS = {"boost_purchase", "subscription_purchase"}

DRY = "--dry-run" in sys.argv


def dlv_name(key):
    return "DLV - %s" % key


def trigger_name(event):
    return "CE - %s" % event


def existing(ws, kind):
    """{name: resource} for variables/triggers/tags already in the workspace."""
    items = gtm_api.get("/%s/%s" % (ws, kind)).get(kind[:-1] if kind.endswith("s") else kind, [])
    return {i.get("name"): i for i in items}


def create(ws, kind, body, label):
    if DRY:
        print("  WOULD CREATE  %-9s %s" % (kind[:-1], label))
        return None
    res = gtm_api.post("/%s/%s" % (ws, kind), json=body)
    print("  created       %-9s %s" % (kind[:-1], label))
    return res


def main():
    container = gtm_api.find_container()
    workspace = gtm_api.default_workspace(container)
    ws = workspace["path"].lstrip("/")
    print("Container: %s (%s)  workspace: %s%s\n" % (
        container.get("name"), container.get("publicId"), workspace.get("name"),
        "   [DRY RUN]" if DRY else ""))

    # --- 1. Data Layer Variables ---
    print("Variables")
    have_vars = existing(ws, "variables")
    for key in DLV_KEYS:
        name = dlv_name(key)
        if name in have_vars:
            print("  exists        variable  %s" % name)
            continue
        create(ws, "variables", {
            "name": name,
            "type": "v",
            "parameter": [
                {"type": "integer", "key": "dataLayerVersion", "value": "2"},
                {"type": "boolean", "key": "setDefaultValue", "value": "false"},
                {"type": "template", "key": "name", "value": key},
            ],
        }, name)

    # --- 2. Custom Event triggers ---
    print("\nTriggers")
    have_trigs = existing(ws, "triggers")
    trigger_ids = {}
    for event in EVENTS:
        name = trigger_name(event)
        if name in have_trigs:
            trigger_ids[event] = have_trigs[name].get("triggerId")
            print("  exists        trigger   %s" % name)
            continue
        res = create(ws, "triggers", {
            "name": name,
            "type": "customEvent",
            "customEventFilter": [{
                "type": "equals",
                "parameter": [
                    {"type": "template", "key": "arg0", "value": "{{_event}}"},
                    {"type": "template", "key": "arg1", "value": event},
                ],
            }],
        }, name)
        if res:
            trigger_ids[event] = res.get("triggerId")

    # --- 3. Tags ---
    print("\nTags")
    have_tags = existing(ws, "tags")

    if "Conversion Linker" in have_tags:
        print("  exists        tag       Conversion Linker")
    else:
        create(ws, "tags", {
            "name": "Conversion Linker",
            "type": "gclidw",
            "parameter": [{"type": "boolean", "key": "enableCrossDomain", "value": "false"}],
            "firingTriggerId": [TRIGGER_ALL_PAGES],
        }, "Conversion Linker")

    for event, keys in EVENTS.items():
        name = "GA4 - %s" % event
        if name in have_tags:
            print("  exists        tag       %s" % name)
            continue
        tid = trigger_ids.get(event)
        if not tid:
            print("  SKIP          tag       %s (trigger not created yet — dry run?)" % name)
            continue
        event_params = [{
            "type": "map",
            "map": [
                {"type": "template", "key": "parameter", "value": k},
                {"type": "template", "key": "parameterValue", "value": "{{%s}}" % dlv_name(k)},
            ],
        } for k in keys]
        create(ws, "tags", {
            "name": name,
            "type": "gaawe",
            "parameter": [
                {"type": "template", "key": "eventName", "value": event},
                {"type": "boolean", "key": "sendEcommerceData", "value": "false"},
                {"type": "template", "key": "measurementIdOverride", "value": GA4_MEASUREMENT_ID},
                {"type": "list", "key": "eventSettingsTable", "list": event_params},
            ],
            "firingTriggerId": [tid],
        }, name)

    # --- 4. Ads conversion tags (only once labels exist) ---
    print("\nAds conversion tags")
    if not ADS_CONVERSION_LABELS:
        print("  SKIPPED — ADS_CONVERSION_LABELS is empty. Create the 5 conversion actions in")
        print("  Google Ads, put their labels in this file, and re-run to add them.")
    for event, label in ADS_CONVERSION_LABELS.items():
        name = "Ads - %s" % event
        if name in have_tags:
            print("  exists        tag       %s" % name)
            continue
        tid = trigger_ids.get(event)
        if not tid:
            print("  SKIP          tag       %s (no trigger)" % name)
            continue
        params = [
            {"type": "template", "key": "conversionId", "value": ADS_CONVERSION_ID.replace("AW-", "")},
            {"type": "template", "key": "conversionLabel", "value": label},
        ]
        if event in ADS_VALUE_EVENTS:
            params += [
                {"type": "template", "key": "conversionValue", "value": "{{DLV - value}}"},
                {"type": "template", "key": "currencyCode", "value": "{{DLV - currency}}"},
                {"type": "template", "key": "orderId", "value": "{{DLV - transactionId}}"},
            ]
        create(ws, "tags", {"name": name, "type": "awct", "parameter": params, "firingTriggerId": [tid]}, name)

    print("\nDone.%s Nothing was published — review in GTM Preview, then publish." % (
        " (dry run — no changes made)" if DRY else ""))


if __name__ == "__main__":
    main()
