"""Read-only: the numbers behind (1) trimming the Lease campaigns and (2) a pooled value-bidding test on Metro Rent Out / Metro Sell / Metro Generic Post Ad Intent.

Changes nothing. Run: python ads_lease_and_pool_proposal.py
"""

from collections import defaultdict

from ads_setup_conversions import make_client

CID = "4214066478"


def safe(name):
    return name.encode("ascii", "replace").decode()


def main():
    client = make_client()
    ga = client.get_service("GoogleAdsService")

    info = {}
    for r in ga.search(customer_id=CID, query="""
        SELECT campaign.id, campaign.name, campaign.status, campaign.bidding_strategy_type, campaign.target_cpa.target_cpa_micros,
               campaign.maximize_conversions.target_cpa_micros, campaign_budget.amount_micros, campaign_budget.resource_name, campaign.campaign_budget
        FROM campaign WHERE campaign.status != 'REMOVED'"""):
        c = r.campaign
        tcpa = c.target_cpa.target_cpa_micros or c.maximize_conversions.target_cpa_micros
        info[c.name] = dict(id=c.id, status=c.status.name, bidding=c.bidding_strategy_type.name, tcpa=tcpa / 1e6, budget=r.campaign_budget.amount_micros / 1e6)

    perf = defaultdict(lambda: defaultdict(float))
    for r in ga.search(customer_id=CID, query="""
        SELECT campaign.name, segments.conversion_action_name, metrics.all_conversions, metrics.all_conversions_value
        FROM campaign WHERE segments.date DURING LAST_30_DAYS"""):
        p = perf[r.campaign.name]
        p[r.segments.conversion_action_name] += r.metrics.all_conversions
        p[r.segments.conversion_action_name + " value"] += r.metrics.all_conversions_value
    cost = {}
    for r in ga.search(customer_id=CID, query="""
        SELECT campaign.name, metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.search_budget_lost_impression_share, metrics.search_impression_share
        FROM campaign WHERE segments.date DURING LAST_30_DAYS"""):
        cost[r.campaign.name] = (r.metrics.cost_micros / 1e6, r.metrics.clicks, r.metrics.search_impression_share, r.metrics.search_budget_lost_impression_share)

    def row(name):
        i, p, c = info[name], perf[name], cost.get(name, (0, 0, 0, 0))
        posts, regs, buys, sales = p["Post ad success"], p["New registration"], p["Boost purchase"], p["Boost purchase value"]
        print("  %-44s %-8s %-20s budget Rs %5.0f/day  tCPA Rs %4.0f | 30d cost Rs %6.0f  clicks %4d  posts %5.1f  regs %5.1f  boost %4.1f  sales Rs %6.0f  cost/post Rs %5.0f  imp.share %4.0f%% lost(budget) %3.0f%%" % (
            safe(name)[:44], i["status"], i["bidding"][:20], i["budget"], i["tcpa"], c[0], c[1], posts, regs, buys, sales,
            (c[0] / posts) if posts else 0, c[2] * 100 if c[2] else 0, c[3] * 100 if c[3] else 0))

    print("== Lease campaigns")
    for n in sorted(info):
        if "Lease" in n:
            row(n)
    print("\n== candidates for the pooled value-bidding test")
    for n in ("Metro-Rent Out Property (Owners)", "Metro-Sell Property (Owners/Agents)", "Metro-Generic Post Ad Intent"):
        row(n)
    print("\n== all other campaigns, for reference")
    for n in sorted(info):
        if "Lease" not in n and n not in ("Metro-Rent Out Property (Owners)", "Metro-Sell Property (Owners/Agents)", "Metro-Generic Post Ad Intent") and info[n]["status"] == "ENABLED":
            row(n)


if __name__ == "__main__":
    main()
