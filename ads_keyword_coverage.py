"""Read-only: enabled keywords per ad group (and negatives), with last-30-day impressions, clicks and cost.

Usage:  python ads_keyword_coverage.py
"""

from collections import defaultdict

from ads_setup_conversions import make_client

CID = "4214066478"


def main():
    ga = make_client().get_service("GoogleAdsService")
    q = ("SELECT campaign.name, campaign.status, ad_group.name, ad_group.status, ad_group_criterion.status, ad_group_criterion.negative, "
         "ad_group_criterion.keyword.match_type, metrics.impressions, metrics.clicks, metrics.cost_micros "
         "FROM keyword_view WHERE segments.date DURING LAST_30_DAYS AND ad_group_criterion.negative = FALSE")
    seen = {}
    for r in ga.search(customer_id=CID, query=q):
        key = (r.campaign.name, r.campaign.status.name, r.ad_group.name, r.ad_group.status.name)
        d = seen.setdefault(key, dict(kw=0, imp=0, clk=0, cost=0.0, types=defaultdict(int)))
        if r.ad_group_criterion.status.name == "ENABLED":
            d["kw"] += 1
            d["types"][r.ad_group_criterion.keyword.match_type.name] += 1
        d["imp"] += r.metrics.impressions
        d["clk"] += r.metrics.clicks
        d["cost"] += r.metrics.cost_micros / 1e6
    # keywords with no impressions don't appear in keyword_view with a date filter -> count all enabled separately
    q2 = ("SELECT campaign.name, campaign.status, ad_group.name, ad_group.status, ad_group_criterion.keyword.match_type "
          "FROM ad_group_criterion WHERE ad_group_criterion.type = KEYWORD AND ad_group_criterion.negative = FALSE "
          "AND ad_group_criterion.status = 'ENABLED' AND ad_group.status != 'REMOVED' AND campaign.status != 'REMOVED'")
    allkw = {}
    for r in ga.search(customer_id=CID, query=q2):
        key = (r.campaign.name, r.campaign.status.name, r.ad_group.name, r.ad_group.status.name)
        d = allkw.setdefault(key, defaultdict(int))
        d[r.ad_group_criterion.keyword.match_type.name] += 1
    print("%-34s %-7s %-30s %-7s %4s  %s  | 30d impr clicks cost" % ("campaign", "status", "ad group", "status", "kw", "EXACT/PHRASE/BROAD"))
    for key in sorted(allkw, key=lambda k: (k[1] != "ENABLED", k[0], k[2])):
        t = allkw[key]
        m = seen.get(key, dict(imp=0, clk=0, cost=0.0))
        print("%-34s %-7s %-30s %-7s %4d  %d/%d/%d  | %6d %5d Rs%6.0f" % (
            key[0][:34], key[1], key[2][:30], key[3], sum(t.values()), t["EXACT"], t["PHRASE"], t["BROAD"], m["imp"], m["clk"], m["cost"]))


if __name__ == "__main__":
    main()
