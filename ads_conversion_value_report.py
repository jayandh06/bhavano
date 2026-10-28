"""Read-only: why is conversion value missing in Google Ads? Lists every conversion action's value settings and what it recorded in the last 30 days.

Run: python ads_conversion_value_report.py
"""

from collections import defaultdict

from ads_setup_conversions import make_client

CID = "4214066478"


def main():
    client = make_client()
    ga = client.get_service("GoogleAdsService")

    print("== conversion actions and their value settings")
    actions = {}
    for r in ga.search(customer_id=CID, query="""
        SELECT conversion_action.id, conversion_action.name, conversion_action.status, conversion_action.type, conversion_action.category,
               conversion_action.primary_for_goal, conversion_action.counting_type,
               conversion_action.value_settings.default_value, conversion_action.value_settings.always_use_default_value,
               conversion_action.value_settings.default_currency_code
        FROM conversion_action WHERE conversion_action.status != 'REMOVED'"""):
        c = r.conversion_action
        actions[c.name] = c
        print("  %-34s %-8s %-18s primary=%-5s count=%-9s default_value=%-8s always_default=%-5s cur=%s" % (
            c.name[:34], c.status.name, c.type.name[:18], c.primary_for_goal, c.counting_type.name, c.value_settings.default_value,
            c.value_settings.always_use_default_value, c.value_settings.default_currency_code))

    print("\n== last 30 days, by conversion action (conversions, value counted in 'Conversions value', all-conversions value)")
    rows = defaultdict(lambda: [0.0, 0.0, 0.0])
    for r in ga.search(customer_id=CID, query="""
        SELECT segments.conversion_action_name, metrics.conversions, metrics.conversions_value, metrics.all_conversions, metrics.all_conversions_value
        FROM customer WHERE segments.date DURING LAST_30_DAYS"""):
        v = rows[r.segments.conversion_action_name]
        v[0] += r.metrics.all_conversions
        v[1] += r.metrics.conversions_value
        v[2] += r.metrics.all_conversions_value
    for name, v in sorted(rows.items(), key=lambda kv: -kv[1][0]):
        print("  %-34s all_conv %7.1f   conv_value %9.2f   all_conv_value %9.2f" % (name[:34], v[0], v[1], v[2]))

    print("\n== campaign-level: conversions vs conversion value, last 30 days")
    for r in ga.search(customer_id=CID, query="""
        SELECT campaign.name, campaign.status, campaign.bidding_strategy_type, metrics.conversions, metrics.conversions_value, metrics.cost_micros
        FROM campaign WHERE segments.date DURING LAST_30_DAYS AND metrics.cost_micros > 0 ORDER BY metrics.cost_micros DESC"""):
        print("  %-48s %-22s conv %6.1f value %9.2f cost %8.0f" % (
            r.campaign.name.encode("ascii", "replace").decode()[:48], r.campaign.bidding_strategy_type.name, r.metrics.conversions,
            r.metrics.conversions_value, r.metrics.cost_micros / 1e6))


if __name__ == "__main__":
    main()
