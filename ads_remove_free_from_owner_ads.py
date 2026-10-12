"""Removes "free" from every owner-posting headline/description still carrying it in active
ads, rewriting each into a meaningful sentence without the word - same underlying concern as
ads_fix_boost_to_featured_copy.py: leading with "free" primes resistance to the paid Featured
upsell. Seeker-side copy ("Search Rentals Free", "It's free" in the Seeker Intent ad groups) is
deliberately left untouched - that's browsing being free for buyers/renters, who are never asked
to pay for Featured, so it isn't the same problem.

Covers two groups:
  1. Leads-Search-1 / Ad group 1 - a campaign not touched in any earlier pass this session.
     100% "free" messaging, zero mention of the paid upgrade.
  2. The remaining owner-posting headlines in the 8 ad groups already partly fixed (the ones
     deliberately left alone last time because they didn't co-occur with a Boost/Feature
     mention) - Villa, PG, Apartment, Lease Commercial/Residential, Plot, Commercial, and the
     newly-created Generic/Rent-Out-2.1 ads from that same earlier pass.

Google Ads does not allow editing an existing ad's headline/description text (IMMUTABLE_FIELD) -
same constraint as before. Per ad: CREATE a new RSA with every other headline/description
unchanged and only the flagged ones swapped, then PAUSE the old one (never removed).

Run: python ads_remove_free_from_owner_ads.py --dry-run
     python ads_remove_free_from_owner_ads.py
"""

import sys

from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException

CID = "4214066478"
DRY = "--dry-run" in sys.argv

# ad_id -> {old text: new text} covering both headlines and descriptions for that ad.
REPLACEMENTS = {
    "826475343054": {  # Leads-Search-1 / Ad group 1
        "List Your Property Free": "List Your Property Today",
        "Post Property Ad Free": "Post Your Property Ad",
        "Post Free, Zero Fees": "Zero Fees, Fast Listing",
        "Owners Post Free Today": "Owners Post Here Today",
        "Free Property Listing Site": "Trusted Property Listing Site",
        "Bhavano: Post Free Ads": "Bhavano: Post Your Ad",
        "Post your house, flat, plot or PG free on Bhavano. Zero platform fees.":
            "Post your house, flat, plot or PG on Bhavano. Zero platform fees.",
        "Owners and landlords list free. Your ad goes live in minutes and reaches renters.":
            "Owners and landlords list here. Your ad goes live in minutes and reaches renters.",
        "Selling or renting? Post a free ad and get genuine enquiries from real people.":
            "Selling or renting? Post your ad and get genuine enquiries from real people.",
    },
    "826475349114": {"Free Villa Ad Posting": "List Your Villa For Rent",
        "Create a free rental listing, add photos, and get discovered by serious tenants fast.":
            "List your rental, add photos, and get discovered by serious tenants fast."},
    "826514581603": {"Free Villa Ad Posting": "List Your Villa For Rent",
        "Create a free rental listing, add photos, and get discovered by serious tenants fast.":
            "List your rental, add photos, and get discovered by serious tenants fast."},
    "826514573182": {"Free Villa Ad Posting": "List Your Villa For Sale",
        "Post Villa For Sale Free": "Post Your Villa For Sale",
        "Create a free listing, add photos, and get discovered by serious buyers near you.":
            "List your property, add photos, and get discovered by serious buyers near you."},
    "826514573410": {"Free Villa Ad Posting": "List Your Villa For Sale",
        "Post Villa For Sale Free": "Post Your Villa For Sale",
        "Create a free listing, add photos, and get discovered by serious buyers near you.":
            "List your property, add photos, and get discovered by serious buyers near you."},
    "826475355297": {"PG Owner? Post Ad Free": "PG Owner? Post Your Ad",
        "Free PG Ad Posting": "Quick PG Ad Posting",
        "Create a free PG listing, add photos, and get discovered by serious tenants fast.":
            "List your PG, add photos, and get discovered by serious tenants fast."},
    "826475362728": {"PG Owner? Post Ad Free": "PG Owner? Post Your Ad",
        "Free PG Ad Posting": "Quick PG Ad Posting",
        "Create a free PG listing, add photos, and get discovered by serious tenants fast.":
            "List your PG, add photos, and get discovered by serious tenants fast."},
    "826475361294": {"Post Apartment Ad Free": "Post Your Apartment Ad",
        "Flat Listing Site, Free": "Trusted Flat Listing Site",
        "Post your flat or apartment ad free on Bhavano.com. Reach genuine buyers directly.":
            "Post your flat or apartment ad on Bhavano.com. Reach genuine buyers directly."},
    "826514581165": {"Post Apartment Ad Free": "Post Your Apartment Ad",
        "Flat Listing Site, Free": "Trusted Flat Listing Site",
        "Post your flat or apartment ad free on Bhavano.com. Reach genuine buyers directly.":
            "Post your flat or apartment ad on Bhavano.com. Reach genuine buyers directly."},
    "826475362947": {"List Shop for Lease Free": "List Shop for Lease Today",
        "Post your office / shop for lease free on Bhavano.com Reach Verified business tenants fast":
            "Post your office/shop for lease on Bhavano.com. Reach verified tenants fast."},
    "826514552365": {"List Shop for Lease Free": "List Shop for Lease Today",
        "Post your office / shop for lease free on Bhavano.com Reach Verified business tenants fast":
            "Post your office/shop for lease on Bhavano.com. Reach verified tenants fast."},
    "827193859347": {"List Shop for Lease Free": "List Shop for Lease Today",
        "Post your office / shop for lease free on Bhavano.com Reach Verified business tenants fast":
            "Post your office/shop for lease on Bhavano.com. Reach verified tenants fast."},
    "826514561680": {"Post Land For Sale Free": "Post Your Land For Sale",
        "Free Plot Ad Posting": "Quick Plot Ad Posting",
        "Create a free listing, add photos, and get discovered by serious buyers near you.":
            "List your property, add photos, and get discovered by serious buyers near you."},
    "826514573032": {"Post Land For Sale Free": "Post Your Land For Sale",
        "Free Plot Ad Posting": "Quick Plot Ad Posting",
        "Create a free listing, add photos, and get discovered by serious buyers near you.":
            "List your property, add photos, and get discovered by serious buyers near you."},
    "826514573647": {"Free Commercial Ad Posting": "Quick Commercial Ad Posting",
        "Create a free rental listing, add photos, and get discovered by serious tenants fast.":
            "List your rental, add photos, and get discovered by serious tenants fast."},
    "826597076060": {"Free Commercial Ad Posting": "Quick Commercial Ad Posting",
        "Create a free rental listing, add photos, and get discovered by serious tenants fast.":
            "List your rental, add photos, and get discovered by serious tenants fast."},
    "826597247738": {"List Villa for Lease Free": "List Villa for Lease Today",
        "Post your house or villa for long term lease free. Reach verified tenants fast.":
            "Post your house or villa for long term lease. Reach verified tenants fast."},
    "826597293299": {"List Villa for Lease Free": "List Villa for Lease Today",
        "Post your house or villa for long term lease free. Reach verified tenants fast.":
            "Post your house or villa for long term lease. Reach verified tenants fast."},
    "827236897873": {"List Villa for Lease Free": "List Villa for Lease Today",
        "Post your house or villa for long term lease free. Reach verified tenants fast.":
            "Post your house or villa for long term lease. Reach verified tenants fast."},
    "826597270046": {"List Your Home for Lease Free": "List Your Home, Lease Today",
        "Own a house, flat or villa? Post it for lease free and get tenant calls directly.":
            "Own a house, flat or villa? Post it for lease and get tenant calls directly."},
    "827484856506": {"Post Rental Ad Free": "Post Your Rental Ad"},
    "827484722070": {"Post Rental Ad Free": "Post Your Rental Ad"},
    "827484855513": {
        "Post Free Property Ad": "Post Your Property Ad",
        "Post Your Ad, It's Free": "Post Your Ad Today",
        "Sell, Rent or Lease Free": "Sell, Rent or Lease Fast",
        "Owners Post Free Here": "Owners Post Here Today",
        "Post your property ad free on Bhavano.com. Zero platform fees, genuine leads only.":
            "Post your property ad on Bhavano.com. Zero platform fees, genuine leads only.",
        "Post your property ad free and connect with genuine buyers or tenants today.":
            "Post your property ad and connect with genuine buyers or tenants today.",
    },
    "827609070698": {
        "Post Free Property Ad": "Post Your Property Ad",
        "Post Your Ad, It's Free": "Post Your Ad Today",
        "Sell, Rent or Lease Free": "Sell, Rent or Lease Fast",
        "Owners Post Free Here": "Owners Post Here Today",
        "Post your property ad free on Bhavano.com. Zero platform fees, genuine leads only.":
            "Post your property ad on Bhavano.com. Zero platform fees, genuine leads only.",
        "Post your property ad free and connect with genuine buyers or tenants today.":
            "Post your property ad and connect with genuine buyers or tenants today.",
    },
    "824077830944": {
        "Why buy when you can rent? Affordable furniture packages for any space. Get a free quote!":
            "Affordable furniture packages for any space. Request your quote today.",
    },
    "826046952841": {
        "Why buy when you can rent? Affordable furniture packages for any space. Get a free quote!":
            "Affordable furniture packages for any space. Request your quote today.",
    },
}


def as_asset(client, text, pinned):
    asset = client.get_type("AdTextAsset")
    asset.text = text
    if pinned:
        asset.pinned_field = pinned
    return asset


def main():
    client = make_client()
    ga = client.get_service("GoogleAdsService")
    ada_svc = client.get_service("AdGroupAdService")

    ids = ", ".join("'%s'" % i for i in REPLACEMENTS)
    rows = list(ga.search(customer_id=CID, query="""
        SELECT campaign.name, ad_group.name, ad_group.resource_name,
               ad_group_ad.ad.id, ad_group_ad.resource_name, ad_group_ad.status,
               ad_group_ad.ad.final_urls,
               ad_group_ad.ad.responsive_search_ad.headlines,
               ad_group_ad.ad.responsive_search_ad.descriptions,
               ad_group_ad.ad.responsive_search_ad.path1,
               ad_group_ad.ad.responsive_search_ad.path2
        FROM ad_group_ad WHERE ad_group_ad.ad.id IN (%s)
    """ % ids))

    print("%s" % ("[DRY RUN]" if DRY else "[LIVE]"))
    plans = []
    for r in rows:
        ad_id = str(r.ad_group_ad.ad.id)
        repl = REPLACEMENTS[ad_id]
        rsa = r.ad_group_ad.ad.responsive_search_ad
        h_texts = {h.text for h in rsa.headlines}
        d_texts = {d.text for d in rsa.descriptions}
        missing = [old for old in repl if old not in h_texts and old not in d_texts]
        if missing:
            print("  SKIP   ad %s: not found (already changed?) -> %s" % (ad_id, missing))
            continue

        new_headlines = [(repl.get(h.text, h.text), h.pinned_field) for h in rsa.headlines]
        new_descriptions = [(repl.get(d.text, d.text), d.pinned_field) for d in rsa.descriptions]
        plans.append({
            "campaign": r.campaign.name, "ad_group": r.ad_group.name,
            "ad_group_resource": r.ad_group.resource_name,
            "old_ad_resource": r.ad_group_ad.resource_name,
            "final_urls": list(r.ad_group_ad.ad.final_urls),
            "path1": rsa.path1, "path2": rsa.path2,
            "headlines": new_headlines, "descriptions": new_descriptions,
            "changes": repl,
        })
        print("  %s %-45s / %-35s ad %s" % ("valid " if DRY else "queue ", r.campaign.name[:45], r.ad_group.name[:35], ad_id))
        for old, new in repl.items():
            print("           \"%s\"  ->  \"%s\"" % (old, new))

    print("\n%d ad(s) to update." % len(plans))
    if DRY:
        print("[DRY RUN] No live change made (no create attempted).")
        return
    if not plans:
        return

    for plan in plans:
        print("\n--- %s / %s ---" % (plan["campaign"], plan["ad_group"]))
        create_op = client.get_type("AdGroupAdOperation")
        create_op.create.ad_group = plan["ad_group_resource"]
        create_op.create.status = client.enums.AdGroupAdStatusEnum.ENABLED
        create_op.create.ad.final_urls.extend(plan["final_urls"])
        if plan["path1"]:
            create_op.create.ad.responsive_search_ad.path1 = plan["path1"]
        if plan["path2"]:
            create_op.create.ad.responsive_search_ad.path2 = plan["path2"]
        create_op.create.ad.responsive_search_ad.headlines.extend(
            as_asset(client, text, pinned) for text, pinned in plan["headlines"])
        create_op.create.ad.responsive_search_ad.descriptions.extend(
            as_asset(client, text, pinned) for text, pinned in plan["descriptions"])

        try:
            resp = ada_svc.mutate_ad_group_ads(request={"customer_id": CID, "operations": [create_op]})
            new_resource = resp.results[0].resource_name
            print("  created:", new_resource)
        except GoogleAdsException as e:
            print("  CREATE FAILED, old ad left untouched:")
            for err in e.failure.errors:
                print("    error:", err.message)
            continue

        from google.api_core import protobuf_helpers
        pause_op = client.get_type("AdGroupAdOperation")
        pause_op.update.resource_name = plan["old_ad_resource"]
        pause_op.update.status = client.enums.AdGroupAdStatusEnum.PAUSED
        client.copy_from(pause_op.update_mask, protobuf_helpers.field_mask(None, pause_op.update._pb))

        try:
            ada_svc.mutate_ad_group_ads(request={"customer_id": CID, "operations": [pause_op]})
            print("  paused: ", plan["old_ad_resource"])
        except GoogleAdsException as e:
            print("  PAUSE FAILED -- new ad %s is live, old ad %s is also still live (not paused):"
                  % (new_resource, plan["old_ad_resource"]))
            for err in e.failure.errors:
                print("    error:", err.message)


if __name__ == "__main__":
    main()
