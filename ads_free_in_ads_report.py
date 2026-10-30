"""Read-only: enabled responsive search ads (and negatives) that still mention "free", in enabled campaigns.

Run: python ads_free_in_ads_report.py
"""

import re

from ads_setup_conversions import make_client

CID = "4214066478"
FREE = re.compile(r"\bfree\b", re.IGNORECASE)


def main():
    ga = make_client().get_service("GoogleAdsService")
    n = 0
    for r in ga.search(
        customer_id=CID,
        query="""
        SELECT campaign.name, ad_group.name, ad_group_ad.ad.id, ad_group_ad.ad.responsive_search_ad.headlines,
               ad_group_ad.ad.responsive_search_ad.descriptions
        FROM ad_group_ad
        WHERE ad_group_ad.status = 'ENABLED' AND ad_group.status = 'ENABLED' AND campaign.status = 'ENABLED'
          AND ad_group_ad.ad.type = 'RESPONSIVE_SEARCH_AD'
        """,
    ):
        rsa = r.ad_group_ad.ad.responsive_search_ad
        hits = [a.text for a in list(rsa.headlines) + list(rsa.descriptions) if FREE.search(a.text)]
        if hits:
            n += 1
            print("%s | %s | ad %s" % (r.campaign.name, r.ad_group.name, r.ad_group_ad.ad.id))
            for h in hits:
                print("    ", h)
    print("\n%d enabled ads still mention free" % n)

    neg = {}
    for r in ga.search(
        customer_id=CID,
        query="SELECT campaign.name, campaign_criterion.keyword.text FROM campaign_criterion "
        "WHERE campaign_criterion.negative = TRUE AND campaign_criterion.type = 'KEYWORD' AND campaign.status = 'ENABLED'",
    ):
        neg.setdefault(r.campaign.name, []).append(r.campaign_criterion.keyword.text)
    for c, words in sorted(neg.items()):
        print("%s: %d negatives; free-related: %s" % (c, len(words), [w for w in words if re.search("free|without paying|no charge", w, re.I)]))


if __name__ == "__main__":
    main()
