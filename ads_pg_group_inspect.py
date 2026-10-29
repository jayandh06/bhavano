"""Read-only: the Rent Out PG ad group (the template for a coworking group): keywords with match type and Quality Score parts, ads, final URLs.

Run: python ads_pg_group_inspect.py [campaign name]     (default: Metro-Rent Out Property (Owners))
"""

import sys

from ads_setup_conversions import make_client

CID = "4214066478"
CAMPAIGN = sys.argv[1] if len(sys.argv) > 1 else "Metro-Rent Out Property (Owners)"


def safe(s):
    return s.encode("ascii", "replace").decode()


def main():
    client = make_client()
    ga = client.get_service("GoogleAdsService")

    print("== ad group")
    for r in ga.search(customer_id=CID, query=f"""
        SELECT ad_group.id, ad_group.name, ad_group.status, ad_group.type, ad_group.cpc_bid_micros, ad_group.tracking_url_template
        FROM ad_group WHERE campaign.name = '{CAMPAIGN}' AND ad_group.name LIKE '%Rent Out PG%' AND ad_group.status != 'REMOVED'"""):
        g = r.ad_group
        gid = g.id
        print("  id %s  %s  %s  type %s  cpc %s  tracking %s" % (g.id, safe(g.name), g.status.name, g.type_.name, g.cpc_bid_micros, g.tracking_url_template[:80]))

    print("\n== keywords: text / match / status / Quality Score (1-10) / expected CTR / ad relevance / landing page / 30d impr clicks")
    for r in ga.search(customer_id=CID, query=f"""
        SELECT ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, ad_group_criterion.status,
               ad_group_criterion.quality_info.quality_score, ad_group_criterion.quality_info.search_predicted_ctr,
               ad_group_criterion.quality_info.creative_quality_score, ad_group_criterion.quality_info.post_click_quality_score,
               metrics.impressions, metrics.clicks
        FROM keyword_view WHERE campaign.name = '{CAMPAIGN}' AND ad_group.id = {gid} AND ad_group_criterion.status != 'REMOVED'
          AND segments.date DURING LAST_30_DAYS ORDER BY metrics.impressions DESC"""):
        k, q = r.ad_group_criterion, r.ad_group_criterion.quality_info
        print("  %-44s %-7s %-8s QS %-4s ctr %-14s adrel %-14s lp %-14s | %4d %3d" % (
            k.keyword.text[:44], k.keyword.match_type.name, k.status.name, q.quality_score or "-", q.search_predicted_ctr.name[:14],
            q.creative_quality_score.name[:14], q.post_click_quality_score.name[:14], r.metrics.impressions, r.metrics.clicks))

    print("\n== keywords with no traffic in 30 days (so no row above)")
    seen = set()
    for r in ga.search(customer_id=CID, query=f"""
        SELECT ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, ad_group_criterion.status, ad_group_criterion.quality_info.quality_score
        FROM ad_group_criterion WHERE campaign.name = '{CAMPAIGN}' AND ad_group.id = {gid} AND ad_group_criterion.type = 'KEYWORD'
          AND ad_group_criterion.negative = FALSE AND ad_group_criterion.status != 'REMOVED'"""):
        k = r.ad_group_criterion
        print("  %-44s %-7s %-8s QS %s" % (k.keyword.text[:44], k.keyword.match_type.name, k.status.name, k.quality_info.quality_score or "-"))

    print("\n== ads")
    for r in ga.search(customer_id=CID, query=f"""
        SELECT ad_group_ad.ad.id, ad_group_ad.status, ad_group_ad.ad.final_urls, ad_group_ad.ad.responsive_search_ad.headlines,
               ad_group_ad.ad.responsive_search_ad.descriptions, ad_group_ad.ad.responsive_search_ad.path1, ad_group_ad.ad.responsive_search_ad.path2
        FROM ad_group_ad WHERE campaign.name = '{CAMPAIGN}' AND ad_group.id = {gid} AND ad_group_ad.status != 'REMOVED'"""):
        a = r.ad_group_ad
        print("  ad %s  %s  urls %s  paths %s/%s" % (a.ad.id, a.status.name, list(a.ad.final_urls), a.ad.responsive_search_ad.path1, a.ad.responsive_search_ad.path2))
        for h in a.ad.responsive_search_ad.headlines:
            print("      H%s %s" % (" pin:" + h.pinned_field.name if h.pinned_field.name != "UNSPECIFIED" else "", safe(h.text)))
        for d in a.ad.responsive_search_ad.descriptions:
            print("      D %s" % safe(d.text))

    print("\n== campaign-level negatives count and the sitelink/asset note: see campaign settings")


if __name__ == "__main__":
    main()
