"""Rewrites the enabled responsive search ads that still say "free" so they stop attracting people who only want a free listing.

Why (2026-10-30): most users acquired from ads posted free and never bought Featured. The "free" keywords were paused (ads_pause_free_keywords.py);
this removes "free" from the ad text of the ad groups that still have live keywords. A new ad is created with each flagged line swapped (every other
asset, path and final URL copied) and the old one is PAUSED, never removed (Google does not allow editing RSA text). Ad groups left with no enabled
keyword (the "Star - ..." groups built only on free keywords) are skipped: nothing serves from them.

Run: python ads_remove_free_from_remaining_ads.py --dry-run
     python ads_remove_free_from_remaining_ads.py
"""

import re
import sys

from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException
from google.api_core import protobuf_helpers

CID = "4214066478"
DRY = "--dry-run" in sys.argv
FREE = re.compile(r"\bfree\b", re.IGNORECASE)

NO_COMMISSION = "No commission, no broker. Go Featured for more views."
REPLACEMENTS = {
    # Sell
    "Free Property Listing Site": "Property Listing Site",
    "Post Free Property Ads": "Post Property Ads Online",
    "Free Property Sale Ads": "Property Sale Ads",
    "Free Real Estate Ads": "Real Estate Ads For Owners",
    "Sell Your Property Free": "Sell Your Property Online",
    "Free Ad To Sell Flat Or House": "Ad To Sell Flat Or House",
    "Sell Plot, Flat Or House Free": "Sell Plot, Flat Or House",
    "Free Listing On Bhavano.com": "List On Bhavano.com",
    "Property Sale Ads Free": "Property Sale Ads Online",
    "Post your property sale ad free on Bhavano.com. No broker, buyers message you directly.": "Post your property sale ad on Bhavano.com. No broker, buyers message you directly.",
    # Rent out
    "Free Rental Listing Site": "Rental Listing Site",
    "Post Rental Property Free": "Post Your Rental Property",
    "Free Ads For Rent Owners": "Ads For Rent Owners",
    "Post Free Rental Ad": "Post Rental Ad Online",
    "List Flat Or House Free": "List Flat Or House Online",
    "Post your rental property free on Bhavano.com. No broker, tenants message you directly.": "Post your rental property on Bhavano.com. No broker, tenants message you directly.",
    # Generic
    "Free Property Ads Posting Site": "Property Ads Posting Site",
    "Free Real Estate Ads Posting": "Real Estate Ads Posting",
    "Advertise Property For Free": "Advertise Your Property",
    "Post Free Ad For Rent Or Sale": "Post Ad For Rent Or Sale",
    "Sell, Rent Or Lease Free": "Sell, Rent Or Lease Online",
    "Post your property ad free on Bhavano.com. Zero platform fees, no broker, genuine leads.": "Post your property ad on Bhavano.com. Zero platform fees, no broker, genuine leads.",
    "India's real estate classifieds. List to sell, rent or lease in 2 minutes, free.": "India's real estate classifieds. List to sell, rent or lease in 2 minutes.",
    "Free to post, no commission. Connect with buyers or tenants searching in your city.": "No commission. Connect with buyers or tenants searching in your city.",
    "Post your ad free and upgrade to Featured later if you want more views.": "Post your ad and go Featured if you want more views.",
    # Shared
    "Free to post, no commission. Upgrade to Featured later for more views.": NO_COMMISSION,
}


def as_asset(client, text, pinned):
    asset = client.get_type("AdTextAsset")
    asset.text = text
    if pinned:
        asset.pinned_field = pinned
    return asset


def dedupe(items):
    seen, out = set(), []
    for text, pinned in items:
        if text.lower() not in seen:
            seen.add(text.lower())
            out.append((text, pinned))
    return out


def main():
    client = make_client()
    ga = client.get_service("GoogleAdsService")
    ada_svc = client.get_service("AdGroupAdService")

    live_groups = set()
    for r in ga.search(
        customer_id=CID,
        query="SELECT ad_group.id FROM ad_group_criterion WHERE ad_group_criterion.type = 'KEYWORD' AND ad_group_criterion.negative = FALSE "
        "AND ad_group_criterion.status = 'ENABLED' AND ad_group.status = 'ENABLED' AND campaign.status = 'ENABLED'",
    ):
        live_groups.add(r.ad_group.id)

    plans = []
    for r in ga.search(
        customer_id=CID,
        query="""
        SELECT campaign.name, ad_group.id, ad_group.name, ad_group.resource_name, ad_group_ad.ad.id, ad_group_ad.resource_name,
               ad_group_ad.ad.final_urls, ad_group_ad.ad.responsive_search_ad.headlines, ad_group_ad.ad.responsive_search_ad.descriptions,
               ad_group_ad.ad.responsive_search_ad.path1, ad_group_ad.ad.responsive_search_ad.path2
        FROM ad_group_ad
        WHERE ad_group_ad.status = 'ENABLED' AND ad_group.status = 'ENABLED' AND campaign.status = 'ENABLED'
          AND ad_group_ad.ad.type = 'RESPONSIVE_SEARCH_AD'
        """,
    ):
        rsa = r.ad_group_ad.ad.responsive_search_ad
        if not any(FREE.search(a.text) for a in list(rsa.headlines) + list(rsa.descriptions)):
            continue
        label = "%s / %s ad %s" % (r.campaign.name, r.ad_group.name, r.ad_group_ad.ad.id)
        if r.ad_group.id not in live_groups:
            print("skip (no enabled keyword left): %s" % label)
            continue
        unmapped = [a.text for a in list(rsa.headlines) + list(rsa.descriptions) if FREE.search(a.text) and a.text not in REPLACEMENTS]
        if unmapped:
            print("SKIP (no replacement for %s): %s" % (unmapped, label))
            continue
        headlines = dedupe((REPLACEMENTS.get(h.text, h.text), h.pinned_field) for h in rsa.headlines)
        descriptions = dedupe((REPLACEMENTS.get(d.text, d.text), d.pinned_field) for d in rsa.descriptions)
        assert all(len(t) <= 30 for t, _ in headlines), headlines
        assert all(len(t) <= 90 for t, _ in descriptions), descriptions
        assert len(headlines) >= 3 and len(descriptions) >= 2, label
        plans.append(
            {
                "label": label,
                "ad_group": r.ad_group.resource_name,
                "old": r.ad_group_ad.resource_name,
                "urls": list(r.ad_group_ad.ad.final_urls),
                "path1": rsa.path1,
                "path2": rsa.path2,
                "headlines": headlines,
                "descriptions": descriptions,
            }
        )
        print("%s: %s (%d headlines, %d descriptions)" % ("would rewrite" if DRY else "rewrite", label, len(headlines), len(descriptions)))

    print("\n%d ads to rewrite" % len(plans))
    if DRY:
        return

    for p in plans:
        # An ad group allows 3 enabled responsive search ads, so the old ad is paused first and re-enabled if the new one cannot be created.
        def set_old(status):
            op = client.get_type("AdGroupAdOperation")
            op.update.resource_name = p["old"]
            op.update.status = status
            client.copy_from(op.update_mask, protobuf_helpers.field_mask(None, op.update._pb))
            ada_svc.mutate_ad_group_ads(request={"customer_id": CID, "operations": [op]})

        set_old(client.enums.AdGroupAdStatusEnum.PAUSED)
        op = client.get_type("AdGroupAdOperation")
        op.create.ad_group = p["ad_group"]
        op.create.status = client.enums.AdGroupAdStatusEnum.ENABLED
        op.create.ad.final_urls.extend(p["urls"])
        if p["path1"]:
            op.create.ad.responsive_search_ad.path1 = p["path1"]
        if p["path2"]:
            op.create.ad.responsive_search_ad.path2 = p["path2"]
        op.create.ad.responsive_search_ad.headlines.extend(as_asset(client, t, pin) for t, pin in p["headlines"])
        op.create.ad.responsive_search_ad.descriptions.extend(as_asset(client, t, pin) for t, pin in p["descriptions"])
        try:
            ada_svc.mutate_ad_group_ads(request={"customer_id": CID, "operations": [op]})
            print("done: %s" % p["label"])
        except GoogleAdsException as e:
            set_old(client.enums.AdGroupAdStatusEnum.ENABLED)
            print("CREATE FAILED, old ad re-enabled: %s: %s" % (p["label"], [x.message for x in e.failure.errors]))

if __name__ == "__main__":
    main()
