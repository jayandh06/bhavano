"""Read-only: which conversion goals are biddable (counted in "Conversions" and "Conversions value") at account and campaign level.

Run: python ads_conversion_goals_report.py
"""

from collections import defaultdict

from ads_setup_conversions import make_client

CID = "4214066478"


def main():
    client = make_client()
    ga = client.get_service("GoogleAdsService")

    print("== account-level goals (customer_conversion_goal): category / origin / biddable")
    for r in ga.search(customer_id=CID, query="SELECT customer_conversion_goal.category, customer_conversion_goal.origin, customer_conversion_goal.biddable FROM customer_conversion_goal"):
        g = r.customer_conversion_goal
        print("  %-24s %-22s biddable=%s" % (g.category.name, g.origin.name, g.biddable))

    print("\n== campaigns that override the account goals (campaign_conversion_goal): campaign / category / origin / biddable")
    per = defaultdict(list)
    for r in ga.search(customer_id=CID, query="""
        SELECT campaign.name, campaign.status, campaign_conversion_goal.category, campaign_conversion_goal.origin, campaign_conversion_goal.biddable
        FROM campaign_conversion_goal WHERE campaign.status = 'ENABLED'"""):
        g = r.campaign_conversion_goal
        per[r.campaign.name].append((g.category.name, g.origin.name, g.biddable))
    for name, goals in sorted(per.items()):
        shown = [("%s/%s" % (c, o), b) for c, o, b in goals if c in ("PURCHASE", "SUBMIT_LEAD_FORM", "SIGNUP", "PAGE_VIEW", "DEFAULT")]
        print("  %s" % name.encode("ascii", "replace").decode())
        for label, b in shown:
            print("      %-34s biddable=%s" % (label, b))

    print("\n== Boost purchase per campaign, last 30 days: conversions, value, all-conversions value")
    for r in ga.search(customer_id=CID, query="""
        SELECT campaign.name, metrics.conversions, metrics.conversions_value, metrics.all_conversions, metrics.all_conversions_value, segments.conversion_action_name
        FROM campaign WHERE segments.date DURING LAST_30_DAYS AND segments.conversion_action_name = 'Boost purchase' AND metrics.all_conversions > 0"""):
        print("  %-46s all_conv %5.1f all_value %9.2f | conv %5.1f value %9.2f" % (
            r.campaign.name.encode("ascii", "replace").decode()[:46], r.metrics.all_conversions, r.metrics.all_conversions_value, r.metrics.conversions, r.metrics.conversions_value))


if __name__ == "__main__":
    main()
