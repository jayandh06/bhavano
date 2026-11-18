"""Adds headlines that echo the sell keywords added on 2026-11-18 (ads_add_owner_sell_keywords.py) to the enabled responsive search
ads of Metro-Sell and Other-Metro-Sell ad groups 1.1-1.5: "Sell My House By Owner", "Sell Your Land Online" and so on.

Same method and rules as ads_add_keyword_headlines.py: RSA text is immutable, so per enabled ad CREATE a new RSA with every existing
headline / description / path / URL plus the new headlines (never past 15, never a duplicate), and only once that succeeds PAUSE the old
ad (never removed). No "free", no outcome promises, 30 characters or fewer. City names are deliberately not in headlines: one ad serves
several cities, and a "Bengaluru" headline would show to a Delhi searcher. Idempotent. If a group is at Google's ad limit the create
fails and the old ad is left untouched.

Run: python ads_add_sell_headlines.py --dry-run
     python ads_add_sell_headlines.py
"""

import sys

from ads_add_keyword_headlines import as_asset
from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException
from google.api_core import protobuf_helpers

CID = "4214066478"
DRY = "--dry-run" in sys.argv
CAMPAIGNS = ("Metro-Sell Property (Owners/Agents)", "Other-Metro-Sell Property (Owners/Agents)")
MAX_HEADLINES = 15

# ad group name prefix -> new headlines
GROUPS = {
    "Ad Group 1.1": ["Sell My House By Owner", "Sell Your House Online", "List Your House For Sale", "Sell House, No Broker"],
    "Ad Group 1.2": ["Sell My Flat Online", "Sell My Apartment Online", "Sell Flat, No Broker"],
    "Ad Group 1.3": ["Sell Independent House", "Sell My Villa Online"],
    "Ad Group 1.4": ["Sell Your Plot By Owner", "Sell Your Land Online", "List Plot For Sale", "Sell Land, No Broker"],
    "Ad Group 1.5": ["Sell My Shop Online", "Sell My Office Space"],
}
# Slogan headlines no searcher typed; swapped out (in this order, only as many as needed) when an ad is already at 15.
FILLER = ["Bhavano.com", "Villa Sale Made Simple", "Commercial Sale Simplified", "Sell Property, Save Time", "Zero Commission Listing",
          "Post Ad, Get Genuine Leads", "India's Trusted", "Trusted Flat Listing Site", "Zero Commission Flat Sale",
          "Owners Post Here Today", "Get Genuine Leads Fast", "No Platform Commission"]


def main():
    for texts in GROUPS.values():
        for t in texts:
            assert len(t) <= 30 and "free" not in t.lower(), t
    client = make_client()
    ga = client.get_service("GoogleAdsService")
    ada_svc = client.get_service("AdGroupAdService")
    rows = list(ga.search(customer_id=CID, query="""
        SELECT campaign.name, ad_group.id, ad_group.name, ad_group.resource_name, ad_group_ad.ad.id, ad_group_ad.resource_name,
               ad_group_ad.ad.final_urls, ad_group_ad.ad.responsive_search_ad.headlines,
               ad_group_ad.ad.responsive_search_ad.descriptions, ad_group_ad.ad.responsive_search_ad.path1,
               ad_group_ad.ad.responsive_search_ad.path2
        FROM ad_group_ad WHERE campaign.name IN ('%s') AND ad_group_ad.status = 'ENABLED' AND ad_group.status = 'ENABLED'""" % "','".join(CAMPAIGNS)))

    print("[DRY RUN]" if DRY else "[LIVE]")
    plans = []
    for r in rows:
        rsa = r.ad_group_ad.ad.responsive_search_ad
        prefix = next((k for k in GROUPS if r.ad_group.name.startswith(k)), None)
        if not prefix:
            continue
        have = [h.text for h in rsa.headlines]
        pinned = {h.text for h in rsa.headlines if h.pinned_field and h.pinned_field.name != "UNSPECIFIED"}
        wanted = [t for t in GROUPS[prefix] if t.lower() not in {h.lower() for h in have}]
        droppable = [h for f in FILLER for h in have if h.startswith(f) and h not in pinned]
        room = MAX_HEADLINES - len(have)
        add = wanted[:max(room + len(droppable), 0)]
        drop = droppable[:max(len(add) - max(room, 0), 0)]
        label = "%-40s / %-34s ad %s (%d headlines)" % (r.campaign.name[:40], r.ad_group.name[:34].encode("ascii", "replace").decode(),
                                                      r.ad_group_ad.ad.id, len(have))
        if not add:
            print("  skip   %s: %s" % (label, "already has them" if not wanted else "full and nothing droppable"))
            continue
        print("  plan   %s\n           + %s%s" % (label, " | ".join(add), ("\n           - " + " | ".join(drop)) if drop else ""))
        plans.append(dict(label=label, ad_group=r.ad_group.resource_name, old=r.ad_group_ad.resource_name,
                          urls=list(r.ad_group_ad.ad.final_urls), p1=rsa.path1, p2=rsa.path2,
                          heads=[(h.text, h.pinned_field) for h in rsa.headlines if h.text not in drop] + [(t, 0) for t in add],
                          descs=[(d.text, d.pinned_field) for d in rsa.descriptions]))
    if DRY:
        print("\n[DRY RUN] %d ad(s) would get a new ad created and the old one paused. Nothing sent." % len(plans))
        return

    for p in plans:
        print("\n--- %s ---" % p["label"])
        op = client.get_type("AdGroupAdOperation")
        op.create.ad_group = p["ad_group"]
        op.create.status = client.enums.AdGroupAdStatusEnum.ENABLED
        op.create.ad.final_urls.extend(p["urls"])
        if p["p1"]:
            op.create.ad.responsive_search_ad.path1 = p["p1"]
        if p["p2"]:
            op.create.ad.responsive_search_ad.path2 = p["p2"]
        op.create.ad.responsive_search_ad.headlines.extend(as_asset(client, t, pin) for t, pin in p["heads"])
        op.create.ad.responsive_search_ad.descriptions.extend(as_asset(client, t, pin) for t, pin in p["descs"])
        try:
            res = ada_svc.mutate_ad_group_ads(request={"customer_id": CID, "operations": [op]})
            print("  created:", res.results[0].resource_name)
        except GoogleAdsException as e:
            print("  CREATE FAILED, old ad left untouched:", "; ".join(er.message for er in e.failure.errors))
            continue
        pause = client.get_type("AdGroupAdOperation")
        pause.update.resource_name = p["old"]
        pause.update.status = client.enums.AdGroupAdStatusEnum.PAUSED
        client.copy_from(pause.update_mask, protobuf_helpers.field_mask(None, pause.update._pb))
        try:
            ada_svc.mutate_ad_group_ads(request={"customer_id": CID, "operations": [pause]})
            print("  paused: ", p["old"])
        except GoogleAdsException as e:
            print("  PAUSE FAILED, both ads are live:", "; ".join(er.message for er in e.failure.errors))


if __name__ == "__main__":
    main()
