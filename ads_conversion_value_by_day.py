"""Read-only: conversions and conversion value per day for the last 10 days, so a 'zero today' can be told apart from a real gap.

Run: python ads_conversion_value_by_day.py
"""

from collections import defaultdict

from ads_setup_conversions import make_client

CID = "4214066478"


def main():
    client = make_client()
    ga = client.get_service("GoogleAdsService")
    days = defaultdict(lambda: [0.0, 0.0, 0.0, 0.0])
    for r in ga.search(customer_id=CID, query="""
        SELECT segments.date, metrics.conversions, metrics.conversions_value, metrics.all_conversions, metrics.all_conversions_value
        FROM customer WHERE segments.date DURING LAST_14_DAYS ORDER BY segments.date"""):
        d = days[r.segments.date]
        d[0] += r.metrics.conversions
        d[1] += r.metrics.conversions_value
        d[2] += r.metrics.all_conversions
        d[3] += r.metrics.all_conversions_value
    print("date         conversions  conv_value   all_conv   all_conv_value   (by click date)")
    for day in sorted(days):
        d = days[day]
        print("%s  %10.1f  %10.2f  %9.1f  %14.2f" % (day, d[0], d[1], d[2], d[3]))

    print("\nBoost purchase only, by click date")
    rows = defaultdict(lambda: [0.0, 0.0])
    for r in ga.search(customer_id=CID, query="""
        SELECT segments.date, segments.conversion_action_name, metrics.conversions, metrics.conversions_value, metrics.all_conversions, metrics.all_conversions_value
        FROM customer WHERE segments.date DURING LAST_14_DAYS AND segments.conversion_action_name = 'Boost purchase'"""):
        d = rows[r.segments.date]
        d[0] += r.metrics.all_conversions
        d[1] += r.metrics.all_conversions_value
    for day in sorted(rows):
        print("%s  boost purchases %5.1f  value %9.2f" % (day, rows[day][0], rows[day][1]))


if __name__ == "__main__":
    main()
