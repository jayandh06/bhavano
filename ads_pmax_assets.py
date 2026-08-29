"""Swaps the Performance Max asset group's text from seeker-facing to owner-facing.

Companion to ads_retarget_owners.py, which fixed the targeting. This fixes the creative, which
was still greeting the newly-targeted landlords with "Find Your Next Home". Google generated
the original copy from the campaign's first setup, so roughly three quarters of it sold the
wrong side of the marketplace.

Text only. The 23 auto-generated images and 4 auto-generated videos are left alone — replacing
those is a judgement about what the pictures should show, not something to script.

Adds and removes go out as ONE AssetGroupAsset mutate. PMax enforces minimums (3 headlines,
1 long headline, 2 descriptions) and maximums (15 / 5 / 5), and doing this as remove-then-add
in two requests can trip either end. In a single request only the final state is validated.

Text assets are deduplicated by Google, so any text that already exists as an asset is reused
rather than created a second time.

Run: python ads_pmax_assets.py --dry-run
     python ads_pmax_assets.py
"""

import sys

from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException

CID = "4214066478"

# Seeker-facing copy to drop. Matched on exact text, so anything edited by hand in the UI since
# is left alone rather than silently replaced.
REMOVE = {
    "HEADLINE": [
        "Rent Properties in Bengaluru",
        "Rent Coworking Desks Instantly",
        "Buy or Rent Your Next Home",
        "Find Affordable PG Stays",
        # Same copy, re-added below in title case — Google's own style, and mixed
        # capitalisation across headlines costs Ad Strength.
        "Sell your House",
        "Sell your Apartment",
    ],
    "LONG_HEADLINE": [
        "Find Your Next Home, Plot, Or Commercial Space On Bhavano Today",
        "India's Classifieds Marketplace: Buy, Sell, Rent, Or Lease Properties",
        "Discover Verified Rental Listings And Coworking Desks In Bengaluru",
        "Browse Premium Commercial Spaces And PG Stays On Bhavano Marketplace",
    ],
    "DESCRIPTION": [
        "Rent comfortable PG stays and vibrant coworking desks. View top local options today.",
        "Find your perfect home, plot, or commercial space. Explore our extensive listings.",
        "Discover premium commercial real estate and office spaces. Browse top listings today.",
        "Connect directly with trusted real estate agents and sellers. Find your match today.",
    ],
}

# No city names anywhere: the old headline hardcoded Bengaluru, wasting the slot in the other
# 37 cities. The four angles below (free / no broker / fast / what you can list) are deliberate
# — Google needs genuinely different headlines to have anything worth testing.
ADD = {
    "HEADLINE": [
        "Sell Your House",
        "Sell Your Apartment",
        "List Your Property Free",
        "Rent Out Your House Fast",
        "Post Property Ad Free",
        "Zero Brokerage Listing",
        "Reach Tenants Directly",
        "Owners Post Free Today",
        "Post Your Ad in 2 Minutes",
        "No Agents, No Commission",
        "List Flat, House or Plot",
        "Advertise Your Property",
        "Post PG, Flat or Villa",
        "Your Ad Live in Minutes",
    ],
    "LONG_HEADLINE": [
        "Rent Out Or Sell Your Property Free On Bhavano - No Broker, No Commission",
        "List Your House, Flat, Plot Or PG Free And Reach Tenants Directly",
        "Post Your Property In Two Minutes And Get Genuine Enquiries",
        "Owners And Landlords List Free On India's Trusted Marketplace",
    ],
    "DESCRIPTION": [
        # Deliberately short. A description under ~60 characters survives the tightest
        # placements intact instead of being truncated mid-sentence.
        "Post your property free on Bhavano.",
        "Post your house, flat, plot or PG free on Bhavano. No brokerage, no middlemen.",
        "Owners and landlords list free. Your ad goes live in minutes and reaches renters.",
        "List your property yourself. No agent fees, no commission, full control.",
    ],
}

LIMITS = {"HEADLINE": 15, "LONG_HEADLINE": 5, "DESCRIPTION": 5}

DRY = "--dry-run" in sys.argv


def main():
    client = make_client()
    ga = client.get_service("GoogleAdsService")

    def rows(query):
        return list(ga.search(customer_id=CID, query=query))

    current = {}
    asset_group = None
    # Excluding REMOVED matters: removing an AssetGroupAsset tombstones the row rather than
    # deleting it, so an unfiltered query keeps returning last run's discarded copy and this
    # reports 21 headlines against a cap of 15 on an asset group that is already correct.
    for r in rows(
        "SELECT asset_group.resource_name, asset_group_asset.resource_name, "
        "asset_group_asset.field_type, asset.text_asset.text FROM asset_group_asset "
        "WHERE asset_group_asset.status != 'REMOVED'"
    ):
        ft = r.asset_group_asset.field_type.name
        if ft not in LIMITS:
            continue
        asset_group = r.asset_group.resource_name
        current.setdefault(ft, {})[r.asset.text_asset.text] = r.asset_group_asset.resource_name

    if asset_group is None:
        raise SystemExit("No asset group found with text assets.")

    removes, adds = [], []
    print("Account %s%s\n" % (CID, "   [DRY RUN]" if DRY else ""))
    for ft in ("HEADLINE", "LONG_HEADLINE", "DESCRIPTION"):
        have = current.get(ft, {})
        drop = [t for t in REMOVE[ft] if t in have]
        new = [t for t in ADD[ft] if t not in have]
        final = len(have) - len(drop) + len(new)
        print("%s: %d now, -%d, +%d -> %d (max %d)%s" % (
            ft, len(have), len(drop), len(new), final, LIMITS[ft],
            "   *** OVER LIMIT ***" if final > LIMITS[ft] else ""))
        for t in drop:
            print("   -  %s" % t)
        for t in new:
            print("   +  %s" % t)
        removes += [have[t] for t in drop]
        adds += [(ft, t) for t in new]

    if not removes and not adds:
        print("\nNothing to do — the asset group already carries the owner-facing copy.")
        return
    if DRY:
        print("\n[dry run] nothing created or removed.")
        return

    # Reuse any text asset that already exists — Google deduplicates them, so creating a second
    # asset with identical text is rejected rather than silently ignored.
    existing = {r.asset.text_asset.text: r.asset.resource_name
                for r in rows("SELECT asset.resource_name, asset.text_asset.text "
                              "FROM asset WHERE asset.type = 'TEXT'")}
    need = [t for _, t in adds if t not in existing]
    if need:
        asset_svc = client.get_service("AssetService")
        ops = []
        for text in need:
            op = client.get_type("AssetOperation")
            op.create.text_asset.text = text
            ops.append(op)
        try:
            res = asset_svc.mutate_assets(customer_id=CID, operations=ops)
        except GoogleAdsException as e:
            raise SystemExit("Creating text assets failed: %s"
                             % (e.failure.errors[0].message if e.failure.errors else e))
        for text, r in zip(need, res.results):
            existing[text] = r.resource_name
        print("\ncreated %d text assets" % len(need))

    svc = client.get_service("AssetGroupAssetService")
    ops = []
    for ft, text in adds:
        op = client.get_type("AssetGroupAssetOperation")
        op.create.asset_group = asset_group
        op.create.asset = existing[text]
        op.create.field_type = getattr(client.enums.AssetFieldTypeEnum, ft)
        ops.append(op)
    for rn in removes:
        op = client.get_type("AssetGroupAssetOperation")
        op.remove = rn
        ops.append(op)

    try:
        svc.mutate_asset_group_assets(customer_id=CID, operations=ops)
    except GoogleAdsException as e:
        raise SystemExit("Asset group update failed: %s"
                         % (e.failure.errors[0].message if e.failure.errors else e))
    print("linked %d new assets, removed %d old ones" % (len(adds), len(removes)))
    print("\nCheck Ad Strength in the UI. Images and videos are untouched and still show people")
    print("browsing for homes — worth replacing once the text has had a week to settle.")


if __name__ == "__main__":
    main()
