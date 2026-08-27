"""Read-only view of the Google Ads account: conversion actions, conversion goals, campaigns.

Answers "what is actually configured in Ads?" without clicking through the UI, and without
changing anything. Nothing here mutates — it is all GAQL SELECTs.

Reuses the credentials and the login-customer-id handling from ads_setup_conversions.py.

Run: python ads_report.py
"""

from ads_setup_conversions import make_client
import os

from dotenv import load_dotenv
from google.ads.googleads.errors import GoogleAdsException

load_dotenv(".env")


def rows(client, customer_id, query):
    svc = client.get_service("GoogleAdsService")
    return list(svc.search(customer_id=customer_id, query=query))


def name_of(enum_value, client=None, enum_type=None):
    """Renders an enum as its name.

    Depending on the proto-plus version these come back either as an enum member (has .name)
    or as a bare int, in which case the value has to be mapped through the client's enum type.
    """
    if hasattr(enum_value, "name"):
        return enum_value.name
    if client is not None and enum_type is not None:
        try:
            return getattr(client.enums, enum_type)(enum_value).name
        except Exception:
            pass
    return str(enum_value).rsplit(".", 1)[-1]


def main():
    customer_id = os.getenv("GOOGLE_ADS_CUSTOMER_ID", "").replace("-", "")
    client = make_client()

    print("=" * 78)
    print("CONVERSION ACTIONS")
    print("=" * 78)
    try:
        res = rows(client, customer_id, """
            SELECT conversion_action.name, conversion_action.category,
                   conversion_action.status, conversion_action.type,
                   conversion_action.counting_type,
                   conversion_action.primary_for_goal,
                   conversion_action.value_settings.default_value,
                   conversion_action.value_settings.always_use_default_value
            FROM conversion_action
            ORDER BY conversion_action.name
        """)
        if not res:
            print("  (none)")
        for r in res:
            ca = r.conversion_action
            vs = ca.value_settings
            value = "fixed %.2f" % vs.default_value if vs.always_use_default_value else "per-conversion"
            print("  %-24s %-18s %-9s %-14s primary=%-5s value=%s" % (
                ca.name, name_of(ca.category, client, "ConversionActionCategoryEnum"),
                name_of(ca.status, client, "ConversionActionStatusEnum"),
                name_of(ca.counting_type, client, "ConversionActionCountingTypeEnum"),
                ca.primary_for_goal, value))
    except GoogleAdsException as e:
        print("  error:", e)

    print("\n" + "=" * 78)
    print("CUSTOMER CONVERSION GOALS  (which categories bidding optimises toward)")
    print("=" * 78)
    try:
        res = rows(client, customer_id, """
            SELECT customer_conversion_goal.category, customer_conversion_goal.origin,
                   customer_conversion_goal.biddable
            FROM customer_conversion_goal
        """)
        biddable = [r for r in res if r.customer_conversion_goal.biddable]
        if not biddable:
            print("  (no biddable goals — campaigns are not optimising toward any conversion)")
        for r in biddable:
            g = r.customer_conversion_goal
            print("  %-20s origin=%s" % (name_of(g.category, client, "ConversionActionCategoryEnum"),
                                        name_of(g.origin, client, "ConversionOriginEnum")))
        others = len(res) - len(biddable)
        if others:
            print("  (+%d non-biddable category/origin combinations)" % others)
    except GoogleAdsException as e:
        print("  error:", e)

    print("\n" + "=" * 78)
    print("CAMPAIGNS")
    print("=" * 78)
    try:
        res = rows(client, customer_id, """
            SELECT campaign.id, campaign.name, campaign.status,
                   campaign.advertising_channel_type, campaign.bidding_strategy_type
            FROM campaign
            ORDER BY campaign.name
        """)
        if not res:
            print("  (no campaigns in this account)")
        for r in res:
            c = r.campaign
            print("  %-30s %-10s %-14s bidding=%s" % (
                c.name, name_of(c.status, client, "CampaignStatusEnum"),
                name_of(c.advertising_channel_type, client, "AdvertisingChannelTypeEnum"),
                name_of(c.bidding_strategy_type, client, "BiddingStrategyTypeEnum")))
    except GoogleAdsException as e:
        print("  error:", e)


if __name__ == "__main__":
    main()
