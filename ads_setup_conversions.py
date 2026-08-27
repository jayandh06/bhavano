"""Creates the 5 Google Ads conversion actions and prints their conversion labels.

Step 4.2 of docs/plans/consolidate-analytics-and-ads-on-gtm.md. The labels it prints go into
ADS_CONVERSION_LABELS in gtm_build.py; re-running that adds the matching GTM tags.

Requires a working GOOGLE_ADS_REFRESH_TOKEN. If test_connection.py fails with `invalid_grant`,
re-mint it first:  python get_refresh_token.py
(If your OAuth consent screen is in Testing mode, tokens expire every 7 days — publish the app
to "In production" in the Cloud console's OAuth consent screen to stop that recurring.)

Idempotent: an existing conversion action with the same name is left alone and its label read
back, so re-running is safe and is also the way to just fetch labels.

Run: python ads_setup_conversions.py --dry-run
     python ads_setup_conversions.py
"""

import argparse
import os
import re
import sys

from dotenv import load_dotenv
from google.ads.googleads.client import GoogleAdsClient
from google.ads.googleads.errors import GoogleAdsException

load_dotenv()

# name -> (category, counts a monetary value?)  Mirrors the plan's step 4.2 table.
CONVERSIONS = [
    ("Boost purchase", "PURCHASE", True),
    ("Subscription purchase", "PURCHASE", True),
    ("Post ad success", "SUBMIT_LEAD_FORM", False),
    ("New registration", "SIGNUP", False),
    ("Save a search", "SUBMIT_LEAD_FORM", False),
]

# Conversion action name -> the dataLayer event it corresponds to, for the printed mapping.
EVENT_FOR = {
    "Boost purchase": "boost_purchase",
    "Subscription purchase": "subscription_purchase",
    "Post ad success": "post_ad_success",
    "New registration": "signup_complete",
    "Save a search": "save_search",
}


def make_client():
    cfg = {
        "developer_token": os.getenv("GOOGLE_ADS_DEVELOPER_TOKEN"),
        "client_id": os.getenv("GOOGLE_ADS_CLIENT_ID"),
        "client_secret": os.getenv("GOOGLE_ADS_CLIENT_SECRET"),
        "refresh_token": os.getenv("GOOGLE_ADS_REFRESH_TOKEN"),
        "login_customer_id": os.getenv("GOOGLE_ADS_LOGIN_CUSTOMER_ID", "").replace("-", ""),
        "use_proto_plus": True,
    }
    missing = [k for k, v in cfg.items() if v is None or v == ""]
    if missing:
        raise SystemExit("Missing from .env: %s" % ", ".join(missing))
    return GoogleAdsClient.load_from_dict(cfg)


def existing_actions(client, customer_id):
    """{name: (resource_name, label)} for conversion actions already in the account."""
    svc = client.get_service("GoogleAdsService")
    query = """
        SELECT conversion_action.resource_name, conversion_action.name,
               conversion_action.status, conversion_action.tag_snippets
        FROM conversion_action
    """
    out = {}
    for row in svc.search(customer_id=customer_id, query=query):
        ca = row.conversion_action
        out[ca.name] = (ca.resource_name, extract_label(ca))
    return out


def extract_label(conversion_action):
    """Pulls the conversion label out of a tag snippet's send_to value ('AW-123/LABEL')."""
    for snip in conversion_action.tag_snippets:
        for text in (snip.event_snippet or "", snip.global_site_tag or ""):
            m = re.search(r"AW-\d+/([\w-]+)", text)
            if m:
                return m.group(1)
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    customer_id = os.getenv("GOOGLE_ADS_CUSTOMER_ID", "").replace("-", "")
    if not customer_id:
        raise SystemExit("GOOGLE_ADS_CUSTOMER_ID not set in .env")

    client = make_client()
    try:
        have = existing_actions(client, customer_id)
    except GoogleAdsException as e:
        raise SystemExit("Google Ads API error: %s" % e)

    print("Account %s — %d existing conversion actions\n" % (customer_id, len(have)))

    to_create = [c for c in CONVERSIONS if c[0] not in have]
    for name, category, has_value in CONVERSIONS:
        if name in have:
            print("  exists   %-24s label=%s" % (name, have[name][1] or "(no label yet)"))
        else:
            print("  %s  %-24s category=%s value=%s" % (
                "WOULD CREATE" if args.dry_run else "creating", name, category, has_value))

    if args.dry_run:
        print("\n[dry run] nothing created.")
        return

    if to_create:
        svc = client.get_service("ConversionActionService")
        ops = []
        for name, category, has_value in to_create:
            op = client.get_type("ConversionActionOperation")
            ca = op.create
            ca.name = name
            ca.type_ = client.enums.ConversionActionTypeEnum.WEBPAGE
            ca.category = getattr(client.enums.ConversionActionCategoryEnum, category)
            ca.status = client.enums.ConversionActionStatusEnum.ENABLED
            # "One" per the plan — a repeat post-ad in the same session is not a second conversion.
            ca.counting_type = client.enums.ConversionActionCountingTypeEnum.ONE_PER_CLICK
            ca.value_settings.always_use_default_value = not has_value
            if not has_value:
                ca.value_settings.default_value = 0.0
            ops.append(op)
        try:
            resp = svc.mutate_conversion_actions(customer_id=customer_id, operations=ops)
        except GoogleAdsException as e:
            raise SystemExit("Create failed: %s" % e)
        print("\nCreated %d conversion action(s)." % len(resp.results))
        have = existing_actions(client, customer_id)

    print("\n=== PASTE INTO gtm_build.py ADS_CONVERSION_LABELS ===")
    print("ADS_CONVERSION_LABELS = {")
    for name, _, _ in CONVERSIONS:
        label = have.get(name, (None, None))[1]
        event = EVENT_FOR[name]
        if label:
            print('    "%s": "%s",' % (event, label))
        else:
            print('    # "%s": "<label missing — open %s in Ads UI>",' % (event, name))
    print("}")
    if any(have.get(n, (None, None))[1] is None for n, _, _ in CONVERSIONS):
        print("\nNote: a label can take a few minutes to appear after creation. Re-run to fetch.")


if __name__ == "__main__":
    sys.exit(main())
