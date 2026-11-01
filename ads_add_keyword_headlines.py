"""Adds headlines that echo the keywords added on 2026-11-01 (ads_add_thin_group_keywords.py) to the enabled responsive search ads
of those ten ad groups: "by owner", warehouse / showroom, "list your ... for sale", "let out your villa" and so on.

Google Ads does not allow editing an existing RSA's text (IMMUTABLE_FIELD), so per enabled ad, in this order (same method as
ads_fix_boost_to_featured_copy.py): 1. CREATE a new RSA in the same ad group with every existing headline / description / path /
final URL plus the new headlines (never past the 15-headline limit, never a duplicate); 2. only once that succeeds, PAUSE the old
ad (never removed, so it can be switched back on). Sequential per ad. Rules: no "free", nothing that promises an outcome, each
headline 30 characters or fewer. Idempotent: an ad that already has the headlines is skipped.

Run: python ads_add_keyword_headlines.py --dry-run
     python ads_add_keyword_headlines.py
"""

import sys

from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException
from google.api_core import protobuf_helpers

CID = "4214066478"
DRY = "--dry-run" in sys.argv

SELL_APT = ["Sell Flat By Owner", "List Your Flat For Sale", "Advertise Your Apartment", "Sell Apartment By Owner"]
SELL_VILLA = ["Sell Villa By Owner", "List Your Villa For Sale", "Advertise Your Villa", "Sell Villa, No Broker"]
SELL_COMM = ["Sell Your Warehouse Online", "Sell Showroom Or Office", "List Your Shop For Sale", "Sell Commercial, No Broker"]
LEASE_COMM = ["Lease Out Your Shop", "Lease Out Your Warehouse", "Lease Showroom Or Office", "List Your Office For Lease"]
GENERIC = ["List Property For Sale Or Rent", "Where To Post Property Ad", "Advertise Property Online", "Sell Property Without Broker"]
RENT_VILLA = ["Rent Out Your Villa", "Let Out Your Villa", "Give Villa On Rent", "List Independent House"]

# ad group id (apps/bff/src/ads/campaign-names.ts) -> new headlines
GROUPS = {
    "205333958048": SELL_APT, "200422014173": SELL_APT,
    "202583649071": SELL_VILLA,
    "196651916541": SELL_COMM, "200422014133": SELL_COMM,
    "198411059486": LEASE_COMM,
    "198419903663": GENERIC, "201547741818": GENERIC,
    "201241519122": RENT_VILLA, "198875640445": RENT_VILLA,
}
MAX_HEADLINES = 15

# Filler that says nothing a searcher typed (slogans, "trusted site", "made simple"). When an ad is already at 15 headlines these are
# the ones swapped out, in this order and only as many as needed; a headline that matches a keyword is never dropped.
FILLER = {
    "villa_rent": ["Villa Renting Made Simple", "Zero Commission Rental Ads", "Post Ad, Get Real Inquiries", "Villa Owners Start Here"],
    "lease": ["Bhavano.com", "India's Trusted Lease Site", "Zero Commission Leasing", "Get Tenant Enquiries Directly"],
    "generic": ["Owners Post Here Today", "Get Genuine Leads Fast", "India's Trusted Listing Site", "No Platform Commission"],
    "apt": ["Bhavano.com", "India's Trusted Flat Site", "Trusted Flat Listing Site", "Zero Commission Flat Sale"],
    "villa": ["Villa Sale Made Simple", "Sell Property, Save Time", "Zero Commission Listing", "Post Ad, Get Genuine Leads"],
    "comm": ["Commercial Sale Simplified", "Sell Property, Save Time", "Zero Commission Listing", "Post Ad, Get Genuine Leads"],
}
FILLER_OF = {id_: "apt" for id_ in ("205333958048", "200422014173")}
FILLER_OF.update({"202583649071": "villa", "196651916541": "comm", "200422014133": "comm", "198411059486": "lease",
                  "198419903663": "generic", "201547741818": "generic", "201241519122": "villa_rent", "198875640445": "villa_rent"})


def is_filler(group_id, text):
    return any(text.startswith(f) for f in FILLER[FILLER_OF[group_id]])


def as_asset(client, text, pinned):
    asset = client.get_type("AdTextAsset")
    asset.text = text
    if pinned:
        asset.pinned_field = pinned
    return asset


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
        FROM ad_group_ad WHERE ad_group.id IN (%s) AND ad_group_ad.status = 'ENABLED'""" % ",".join(GROUPS)))

    print("[DRY RUN]" if DRY else "[LIVE]")
    plans = []
    for r in rows:
        rsa = r.ad_group_ad.ad.responsive_search_ad
        gid = str(r.ad_group.id)
        have = [h.text for h in rsa.headlines]
        pinned = {h.text for h in rsa.headlines if h.pinned_field and h.pinned_field.name != "UNSPECIFIED"}
        wanted = [t for t in GROUPS[gid] if t.lower() not in {h.lower() for h in have}]
        droppable = [h for f in FILLER[FILLER_OF[gid]] for h in have if h.startswith(f) and h not in pinned]
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
