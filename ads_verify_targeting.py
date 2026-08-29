"""Read-only answer to one question: is this account now chasing people who want to POST a
listing, or people who want to FIND one?

Checks every lever that decides that — keywords, PMax search themes, the ad copy on both
campaigns, landing pages, negatives, and which conversion goals bidding optimises toward — and
flags anything still pointing at seekers.

Run: python ads_verify_targeting.py
"""

from ads_intent import classify
from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException

CID = "4214066478"


def main():
    client = make_client()
    ga = client.get_service("GoogleAdsService")

    def rows(q):
        try:
            return list(ga.search(customer_id=CID, query=q))
        except GoogleAdsException as e:
            print("  query failed: %s" % (e.failure.errors[0].message if e.failure.errors else e))
            return []

    problems = []

    def report(label, items):
        """items: list of (text, classification)."""
        seekers = [t for t, c in items if c == "seeker"]
        unclear = [t for t, c in items if c == "unknown"]
        print("\n=== %s (%d) ===" % (label, len(items)))
        print("  owner-facing : %d" % len([1 for _, c in items if c == "owner"]))
        print("  seeker-facing: %d%s" % (len(seekers), "   <-- PROBLEM" if seekers else ""))
        for t in seekers:
            print("     SEEKER: %s" % t[:88])
        for t in unclear:
            print("     unclear: %s" % t[:88])
        if seekers:
            problems.append("%s still has %d seeker entries" % (label, len(seekers)))

    report("ENABLED SEARCH KEYWORDS", [
        (r.ad_group_criterion.keyword.text, classify(r.ad_group_criterion.keyword.text))
        for r in rows("SELECT ad_group_criterion.keyword.text FROM keyword_view "
                      "WHERE ad_group_criterion.status = 'ENABLED'")])

    report("PMAX SEARCH THEMES", [
        (r.asset_group_signal.search_theme.text, classify(r.asset_group_signal.search_theme.text))
        for r in rows("SELECT asset_group_signal.search_theme.text FROM asset_group_signal")
        if r.asset_group_signal.search_theme.text])

    report("PMAX TEXT ASSETS", [
        (r.asset.text_asset.text, classify(r.asset.text_asset.text))
        for r in rows("SELECT asset.text_asset.text, asset_group_asset.field_type "
                      "FROM asset_group_asset WHERE asset_group_asset.status != 'REMOVED'")
        if r.asset.text_asset.text])

    search_ad_text = []
    for r in rows("SELECT ad_group_ad.ad.responsive_search_ad.headlines, "
                  "ad_group_ad.ad.responsive_search_ad.descriptions "
                  "FROM ad_group_ad WHERE ad_group_ad.status != 'REMOVED'"):
        rsa = r.ad_group_ad.ad.responsive_search_ad
        for a in list(rsa.headlines) + list(rsa.descriptions):
            search_ad_text.append((a.text, classify(a.text)))
    report("SEARCH CAMPAIGN AD COPY", search_ad_text)

    print("\n=== LANDING PAGES ===")
    for r in rows("SELECT ad_group_ad.ad.final_urls FROM ad_group_ad "
                  "WHERE ad_group_ad.status != 'REMOVED'"):
        u = list(r.ad_group_ad.ad.final_urls)
        ok = u == ["https://www.bhavano.com/post"]
        print("  search ad   %s%s" % (u, "" if ok else "   <-- not /post"))
        if not ok:
            problems.append("search ad landing page is %s" % u)
    for r in rows("SELECT asset_group.final_urls FROM asset_group"):
        u = list(r.asset_group.final_urls)
        ok = u == ["https://www.bhavano.com/post"]
        print("  asset group %s%s" % (u, "" if ok else "   <-- not /post"))
        if not ok:
            problems.append("asset group landing page is %s" % u)

    print("\n=== BIDDING TOWARD (biddable conversion goals) ===")
    for r in rows("SELECT campaign.name, campaign_conversion_goal.category, "
                  "campaign_conversion_goal.biddable FROM campaign_conversion_goal"):
        g = r.campaign_conversion_goal
        if g.biddable:
            print("  %-32s %s" % (r.campaign.name, g.category.name))
            if g.category.name == "ENGAGEMENT":
                problems.append("%s still bids toward ENGAGEMENT (saved searches)" % r.campaign.name)

    print("\n=== AUDIENCE SIGNAL ===")
    auds = [r for r in rows("SELECT asset_group_signal.audience.audience FROM asset_group_signal")
            if r.asset_group_signal.audience.audience]
    print("  %d configured%s" % (len(auds), "" if auds else "   <-- none; still a UI task"))

    print("\n=== NEGATIVES ===")
    counts = {}
    for r in rows("SELECT campaign.name FROM campaign_criterion "
                  "WHERE campaign_criterion.type = 'KEYWORD'"):
        counts[r.campaign.name] = counts.get(r.campaign.name, 0) + 1
    for k, v in sorted(counts.items()):
        print("  %-32s %d" % (k, v))

    print("\n" + "=" * 70)
    if problems:
        print("NOT FULLY SWITCHED OVER:")
        for p in problems:
            print("  - %s" % p)
    else:
        print("Every lever points at posters. Nothing still targets seekers.")


if __name__ == "__main__":
    main()
