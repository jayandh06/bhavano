"""Ad extensions and ad copy fixes to raise ad relevance / ad rank. Plan: docs/plans/google-ads-keyword-audit-2026-10.md ("Ad rank quick fixes, 2026-10-27").

What it does (nothing is removed; the old ads are paused so they can be switched back on):
  1. Other-Metro-Seeker Intent: each city's Rent ad group gets a NEW responsive ad (15 headlines, 4 descriptions, several with the city and the keyword
     variants house / 2BHK / PG / apartments / rental homes), and the old ad, a plain city swap of the Bengaluru ad rated POOR or AVERAGE, is PAUSED. The new copy does not
     say "verified" (the product has no verified-only listings, see docs/plans/metro-seeker-sitelinks.md).
  2. Other-Metro-Seeker Intent: links the same 4 sitelinks that Metro-Seeker Intent uses (it had none).
  3. Metro-Rent Out, Other-Metro-Rent Out and Metro-Lease: link the 6 image assets the Generic and Sell campaigns already use (they had no images).
  4. Callouts for the 7 enabled owner campaigns: a campaign-level set REPLACES the account-level callouts for that campaign, so the set contains the three accurate
     account callouts (Zero Brokerage, Free to Post Ads, Direct Owner Contact) plus 4 new ones (Photos & Video Uploads, Post In 2 Minutes, Message Tenants Directly,
     Reach Buyers & Tenants). The account callout "Verified Listings" is deliberately left out of the owner campaigns (it is still on the account for the seeker campaigns).

Everything is one batch with temporary ids, so --validate checks it all and a real run is all or nothing. The old ad ids are saved to ads_relevance_assets_backup.json for --rollback.

Run: python ads_relevance_assets.py --dry-run     read-only, prints exactly what would change and checks every length
     python ads_relevance_assets.py --validate    Google validates the batch, nothing changes
     python ads_relevance_assets.py               applies it
     python ads_relevance_assets.py --rollback    unpauses the old seeker ads, pauses the new ones, unlinks what was linked here
"""

import argparse
import json
import os

from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException

CID = "4214066478"
BACKUP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ads_relevance_assets_backup.json")

SEEKER_SOURCE = "Metro-Seeker Intent"
SEEKER_TARGET = "Other-Metro-Seeker Intent"
CITIES = ["Ahmedabad", "Coimbatore", "Jaipur", "Lucknow"]
IMAGE_SOURCE = "Metro-Generic Post Ad Intent"
IMAGE_TARGETS = ["Metro-Rent Out Property (Owners)", "Other-Metro-Rent Out Property (Owners)", "Metro-Lease Property"]
CALLOUT_CAMPAIGNS = [
    "Metro-Generic Post Ad Intent", "Other-Metro-Generic Post Ad Intent", "Metro-Rent Out Property (Owners)",
    "Other-Metro-Rent Out Property (Owners)", "Metro-Sell Property (Owners/Agents)", "Other-Metro-Sell Property (Owners/Agents)",
    "Metro-Lease Property",
]
KEEP_ACCOUNT_CALLOUTS = ["Zero Brokerage", "Free to Post Ads", "Direct Owner Contact"]
NEW_CALLOUTS = ["Photos & Video Uploads", "Post In 2 Minutes", "Message Tenants Directly", "Reach Buyers & Tenants"]


def seeker_copy(city):
    headlines = [
        f"Flats For Rent In {city}", f"House For Rent In {city}", f"2BHK For Rent In {city}", f"Rental Homes In {city}",
        f"PG For Rent In {city}", f"Apartments For Rent {city}", "Owner-Posted Rental Listings", "Browse Homes For Rent",
        "New Listings Added Daily", "Search Rentals Free", "See Photos & Prices", "Contact Owners Directly", "No Login To Browse",
        "Rent Without A Broker", f"Bhavano - {city} Rentals",
    ]
    descriptions = [
        f"Browse flats, houses and PGs for rent in {city}. New listings added daily.",
        "See photos, price and location, then contact the owner directly. No sign-up to browse.",
        f"Find 1BHK to 4BHK homes for rent across {city}. Search free, message owners direct.",
        "Skip the broker: rentals posted by owners and updated daily.",
    ]
    return headlines, descriptions


def check_lengths():
    problems = []
    for city in CITIES:
        h, d = seeker_copy(city)
        problems += ["headline too long (%d): %s" % (len(x), x) for x in h if len(x) > 30]
        problems += ["description too long (%d): %s" % (len(x), x) for x in d if len(x) > 90]
        if len({x.lower() for x in h}) != len(h):
            problems.append("duplicate headline for " + city)
    problems += ["callout too long (%d): %s" % (len(c), c) for c in NEW_CALLOUTS if len(c) > 25]
    return problems


def ascii_safe(t):
    return t.encode("ascii", "replace").decode()


def main():
    ap = argparse.ArgumentParser()
    mode = ap.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true")
    mode.add_argument("--validate", action="store_true")
    mode.add_argument("--rollback", action="store_true")
    args = ap.parse_args()
    problems = check_lengths()
    if problems:
        raise SystemExit("not sending anything:\n  " + "\n  ".join(problems))

    client = make_client()
    ga = client.get_service("GoogleAdsService")
    all_campaigns = [SEEKER_SOURCE, SEEKER_TARGET, IMAGE_SOURCE] + IMAGE_TARGETS + CALLOUT_CAMPAIGNS
    names = ",".join("'%s'" % c for c in sorted(set(all_campaigns)))
    campaigns = {r.campaign.name: r.campaign.resource_name for r in ga.search(customer_id=CID, query=f"""
        SELECT campaign.name, campaign.resource_name FROM campaign WHERE campaign.name IN ({names}) AND campaign.status != 'REMOVED'""")}
    missing = set(all_campaigns) - set(campaigns)
    if missing:
        raise SystemExit("campaigns not found: %s" % sorted(missing))

    def linked(campaign, field_type):
        return {r.campaign_asset.asset: r.campaign_asset.resource_name for r in ga.search(customer_id=CID, query=f"""
            SELECT campaign.name, campaign_asset.asset, campaign_asset.resource_name, campaign_asset.status, campaign_asset.field_type FROM campaign_asset
            WHERE campaign.name = '{campaign}' AND campaign_asset.field_type = '{field_type}' AND campaign_asset.status = 'ENABLED'""")}

    if args.rollback:
        rollback(client, ga, campaigns, linked)
        return

    # 1. seeker ads
    seeker_steps = []
    for city in CITIES:
        rows = list(ga.search(customer_id=CID, query=f"""
            SELECT campaign.name, ad_group.status, ad_group_ad.status, ad_group.resource_name, ad_group.name, ad_group_ad.resource_name, ad_group_ad.ad.id, ad_group_ad.ad.final_urls,
                   ad_group_ad.ad.responsive_search_ad.path1, ad_group_ad.ad.responsive_search_ad.path2, ad_group_ad.ad_strength
            FROM ad_group_ad WHERE campaign.name = '{SEEKER_TARGET}' AND ad_group.status = 'ENABLED' AND ad_group_ad.status = 'ENABLED'
              AND ad_group.name LIKE '%{city} Rent Seekers'"""))
        if len(rows) != 1:
            raise SystemExit("expected one enabled ad in the %s Rent ad group, found %d" % (city, len(rows)))
        r = rows[0]
        seeker_steps.append(dict(city=city, group=r.ad_group.resource_name, old_ad=r.ad_group_ad.resource_name, old_strength=r.ad_group_ad.ad_strength.name,
                                 url=list(r.ad_group_ad.ad.final_urls)[0], path1=r.ad_group_ad.ad.responsive_search_ad.path1,
                                 path2=r.ad_group_ad.ad.responsive_search_ad.path2))
    # 2. sitelinks
    src_sitelinks = linked(SEEKER_SOURCE, "SITELINK")
    have_sitelinks = linked(SEEKER_TARGET, "SITELINK")
    new_sitelinks = [a for a in src_sitelinks if a not in have_sitelinks]
    # 3. images
    src_images = linked(IMAGE_SOURCE, "AD_IMAGE")
    image_links = {c: [a for a in src_images if a not in linked(c, "AD_IMAGE")] for c in IMAGE_TARGETS}
    # 4. callouts
    account = {}
    for r in ga.search(customer_id=CID, query="""
        SELECT asset.resource_name, asset.callout_asset.callout_text, customer_asset.status, customer_asset.field_type FROM customer_asset
        WHERE customer_asset.field_type = 'CALLOUT' AND customer_asset.status = 'ENABLED'"""):
        account[r.asset.callout_asset.callout_text] = r.asset.resource_name
    for k in KEEP_ACCOUNT_CALLOUTS:
        if k not in account:
            raise SystemExit("account callout %r not found" % k)
    callout_links = {}
    for c in CALLOUT_CAMPAIGNS:
        existing = linked(c, "CALLOUT")
        callout_links[c] = existing

    print("1. Other-Metro-Seeker: new ad per city, old ad paused")
    for s in seeker_steps:
        h, d = seeker_copy(s["city"])
        print("   %-11s old ad strength %-8s -> new ad: %d headlines, %d descriptions, final URL %s /%s/%s" % (
            s["city"], s["old_strength"], len(h), len(d), s["url"], s["path1"], s["path2"]))
    print("   headlines (Ahmedabad): " + " | ".join(seeker_copy("Ahmedabad")[0]))
    print("2. sitelinks to link to %s: %d of %d (already linked: %d)" % (SEEKER_TARGET, len(new_sitelinks), len(src_sitelinks), len(have_sitelinks)))
    print("3. image assets to link: " + ", ".join("%s +%d" % (c, len(v)) for c, v in image_links.items()))
    print("4. callouts: %d campaigns get a campaign-level set of %d = %s + %s" % (
        len(CALLOUT_CAMPAIGNS), len(KEEP_ACCOUNT_CALLOUTS) + len(NEW_CALLOUTS), ", ".join(KEEP_ACCOUNT_CALLOUTS), ", ".join(NEW_CALLOUTS)))
    already = {c: v for c, v in callout_links.items() if v}
    if already:
        print("   NOTE: these campaigns already have campaign-level callouts and are skipped: %s" % ", ".join(already))
    if args.dry_run:
        return

    asset_service = client.get_service("AssetService")
    ad_group_ad_service = client.get_service("AdGroupAdService")
    ops = []
    temp = [-1]

    def link(campaign, asset, field):
        op = client.get_type("MutateOperation")
        ca = op.campaign_asset_operation.create
        ca.campaign = campaigns[campaign]
        ca.asset = asset
        ca.field_type = client.enums.AssetFieldTypeEnum[field]
        ops.append(op)

    for s in seeker_steps:
        h, d = seeker_copy(s["city"])
        op = client.get_type("MutateOperation")
        aga = op.ad_group_ad_operation.create
        aga.ad_group = s["group"]
        aga.status = client.enums.AdGroupAdStatusEnum.ENABLED
        aga.ad.final_urls.append(s["url"])
        rsa = aga.ad.responsive_search_ad
        for text in h:
            t = client.get_type("AdTextAsset")
            t.text = text
            rsa.headlines.append(t)
        for text in d:
            t = client.get_type("AdTextAsset")
            t.text = text
            rsa.descriptions.append(t)
        rsa.path1, rsa.path2 = s["path1"], s["path2"]
        ops.append(op)
        op = client.get_type("MutateOperation")
        old = op.ad_group_ad_operation.update
        old.resource_name = s["old_ad"]
        old.status = client.enums.AdGroupAdStatusEnum.PAUSED
        op.ad_group_ad_operation.update_mask.paths.append("status")
        ops.append(op)
    for asset in new_sitelinks:
        link(SEEKER_TARGET, asset, "SITELINK")
    for c, assets in image_links.items():
        for asset in assets:
            link(c, asset, "AD_IMAGE")
    new_callout_assets = []
    for text in NEW_CALLOUTS:
        resource = asset_service.asset_path(CID, temp[0])
        temp[0] -= 1
        op = client.get_type("MutateOperation")
        a = op.asset_operation.create
        a.resource_name = resource
        a.callout_asset.callout_text = text
        ops.append(op)
        new_callout_assets.append(resource)
    for c in CALLOUT_CAMPAIGNS:
        if callout_links[c]:
            continue
        for asset in [account[k] for k in KEEP_ACCOUNT_CALLOUTS] + new_callout_assets:
            link(c, asset, "CALLOUT")

    request = client.get_type("MutateGoogleAdsRequest")
    request.customer_id = CID
    request.mutate_operations.extend(ops)
    request.validate_only = args.validate
    try:
        ga.mutate(request=request)
    except GoogleAdsException as e:
        raise SystemExit("mutate failed:\n%s" % "\n".join(
            "  %s (%s)" % (er.message, er.location.field_path_elements[-1].field_name if er.location.field_path_elements else "-")
            for er in e.failure.errors))
    if args.validate:
        print("\nvalidated only - nothing changed (%d operations)" % len(ops))
        return
    with open(BACKUP, "w", encoding="utf8") as f:
        json.dump({"old_seeker_ads": [s["old_ad"] for s in seeker_steps],
                   "callout_campaigns_set": [c for c in CALLOUT_CAMPAIGNS if not callout_links[c]],
                   "image_targets": IMAGE_TARGETS, "sitelinks_added_to": SEEKER_TARGET}, f, indent=1)
    print("\ndone (%d operations); backup: %s" % (len(ops), BACKUP))


def rollback(client, ga, campaigns, linked):
    with open(BACKUP, encoding="utf8") as f:
        data = json.load(f)
    ops = []
    for old in data["old_seeker_ads"]:
        op = client.get_type("MutateOperation")
        u = op.ad_group_ad_operation.update
        u.resource_name = old
        u.status = client.enums.AdGroupAdStatusEnum.ENABLED
        op.ad_group_ad_operation.update_mask.paths.append("status")
        ops.append(op)
    for r in ga.search(customer_id=CID, query=f"""
        SELECT campaign.name, ad_group_ad.resource_name, ad_group_ad.status, ad_group_ad.ad.responsive_search_ad.headlines FROM ad_group_ad
        WHERE campaign.name = '{SEEKER_TARGET}' AND ad_group_ad.status = 'ENABLED'"""):
        if len(r.ad_group_ad.ad.responsive_search_ad.headlines) == 15:
            op = client.get_type("MutateOperation")
            u = op.ad_group_ad_operation.update
            u.resource_name = r.ad_group_ad.resource_name
            u.status = client.enums.AdGroupAdStatusEnum.PAUSED
            op.ad_group_ad_operation.update_mask.paths.append("status")
            ops.append(op)
    unlink = []
    src_sl = set(linked(SEEKER_SOURCE, "SITELINK"))
    unlink += [res for a, res in linked(SEEKER_TARGET, "SITELINK").items() if a in src_sl]
    src_im = set(linked(IMAGE_SOURCE, "AD_IMAGE"))
    for c in data["image_targets"]:
        unlink += [res for a, res in linked(c, "AD_IMAGE").items() if a in src_im]
    for c in data["callout_campaigns_set"]:
        unlink += list(linked(c, "CALLOUT").values())
    for res in unlink:
        op = client.get_type("MutateOperation")
        op.campaign_asset_operation.remove = res
        ops.append(op)
    request = client.get_type("MutateGoogleAdsRequest")
    request.customer_id = CID
    request.mutate_operations.extend(ops)
    ga.mutate(request=request)
    print("rolled back (%d operations); the new callout assets stay in the library unused" % len(ops))


if __name__ == "__main__":
    main()
