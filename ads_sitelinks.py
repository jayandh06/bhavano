"""Adds generic seeker-facing sitelinks to the Metro-Seeker Intent campaign.

Plan and reasoning: docs/plans/metro-seeker-sitelinks.md. Sitelinks are linked at campaign level
(apply across all 4 ad groups: Bengaluru/Pune x rent-lease/buy), so they're deliberately generic
and non-city-specific — a Bengaluru-only sitelink would also show to Pune searchers and vice
versa.

Kept strictly to search/browse language, same as every other line of copy in this campaign (see
docs/plans/seeker-intent-campaign.md: "No mention of posting, free listing, or 'sell/list'
anywhere in this campaign's copy") — so no "Post Ad Free" sitelink here, unlike the poster
campaigns' image assets (ads_image_assets.py).

Assets are created and linked in ONE GoogleAdsService.mutate using temporary (negative) asset
ids, same pattern as ads_image_assets.py, so --validate checks the whole change end to end
without creating anything, and a real run either fully applies or not at all. Sitelink assets are
named bhavano-sitelink-<slug>; any already in the account are reused rather than created twice.

Run: python ads_sitelinks.py --dry-run     read-only, prints the plan
     python ads_sitelinks.py --validate    Google validates, nothing is created
     python ads_sitelinks.py               applies
     python ads_sitelinks.py --remove      unlinks these sitelinks (rollback; the assets stay in
                                            the library)
"""

import argparse

from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException

CID = "4214066478"
CAMPAIGN_NAME = "Metro-Seeker Intent"

# asset name -> (link text, description 1, description 2, final URL)
SITELINKS = {
    "bhavano-sitelink-browse-all": (
        "Browse All Listings",
        "Flats, PGs, plots & more",
        "Every city, updated daily",
        "https://www.bhavano.com/",
    ),
    "bhavano-sitelink-new-listings": (
        "New Listings Daily",
        "Fresh listings added daily",
        "Be the first to enquire",
        "https://www.bhavano.com/?sort=newest",
    ),
    "bhavano-sitelink-owners-only": (
        "Contact Owners Directly",
        "Skip the broker, save on fees",
        "Message owners directly",
        "https://www.bhavano.com/?postedBy=owner",
    ),
    # Own utm_medium ("google_ads_sitelink"), distinct from every other existing placement in
    # drive-users-to-android-app.md, so Play Console's acquisition report can attribute installs
    # from this sitelink specifically. No on-site app-download page exists yet, so this links
    # straight to the Play Store rather than an intermediate page.
    "bhavano-sitelink-app": (
        "Download the App",
        "Faster browsing & alerts",
        "Available on Android",
        "https://play.google.com/store/apps/details?id=com.finfolia.bhavano&referrer="
        "utm_source%3Dbhavano_web%26utm_medium%3Dgoogle_ads_sitelink%26utm_campaign%3Dmetro_seeker_intent",
    ),
}


def fail(what, e):
    errs = e.failure.errors
    raise SystemExit("%s failed:\n%s" % (what, "\n".join(
        "  %s (%s)" % (er.message, er.location.field_path_elements[-1].field_name
                       if er.location.field_path_elements else "-") for er in errs) or e))


def main():
    p = argparse.ArgumentParser()
    mode = p.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true")
    mode.add_argument("--validate", action="store_true")
    p.add_argument("--remove", action="store_true")
    args = p.parse_args()

    client = make_client()
    ga = client.get_service("GoogleAdsService")

    def rows(query):
        return list(ga.search(customer_id=CID, query=query))

    campaigns = {r.campaign.name: r.campaign.resource_name for r in rows(
        "SELECT campaign.name, campaign.resource_name FROM campaign "
        "WHERE campaign.status != 'REMOVED' AND campaign.advertising_channel_type = 'SEARCH'")}
    if CAMPAIGN_NAME not in campaigns:
        raise SystemExit("Campaign not found: %s" % CAMPAIGN_NAME)
    campaign_res = campaigns[CAMPAIGN_NAME]

    linked = {}  # asset name -> campaign_asset resource
    for r in rows(
        "SELECT campaign_asset.resource_name, asset.name FROM campaign_asset "
        "WHERE campaign_asset.campaign = '%s' AND campaign_asset.field_type = 'SITELINK' "
        "AND campaign_asset.status != 'REMOVED'" % campaign_res
    ):
        linked[r.asset.name] = r.campaign_asset.resource_name

    tag = "   [DRY RUN]" if args.dry_run else "   [VALIDATE ONLY]" if args.validate else ""
    print("Account %s, campaign %s%s\n" % (CID, CAMPAIGN_NAME, tag))

    ops = []
    if args.remove:
        if not linked:
            print("No linked sitelinks to remove.")
        for name, rn in linked.items():
            print("unlink  %s" % name)
            op = client.get_type("MutateOperation")
            op.campaign_asset_operation.remove = rn
            ops.append(op)
    else:
        existing = {r.asset.name: r.asset.resource_name for r in rows(
            "SELECT asset.name, asset.resource_name FROM asset "
            "WHERE asset.type = 'SITELINK' AND asset.name LIKE 'bhavano-sitelink-%'")}
        assets = {}
        temp_id = -1
        for name, (text, d1, d2, url) in SITELINKS.items():
            if name in existing:
                assets[name] = existing[name]
                print("reuse   %-32s %s" % (name, text))
                continue
            rn = "customers/%s/assets/%d" % (CID, temp_id)
            temp_id -= 1
            op = client.get_type("MutateOperation")
            a = op.asset_operation.create
            a.resource_name = rn
            a.name = name
            a.type_ = client.enums.AssetTypeEnum.SITELINK
            a.sitelink_asset.link_text = text
            a.sitelink_asset.description1 = d1
            a.sitelink_asset.description2 = d2
            a.final_urls.append(url)
            ops.append(op)
            assets[name] = rn
            print("create  %-32s %s -> %s" % (name, text, url))
        print()
        new = [n for n in SITELINKS if n not in linked]
        print("link %d sitelink(s) to %s%s" % (
            len(new), CAMPAIGN_NAME, "" if new else " (already linked)"))
        for name in new:
            op = client.get_type("MutateOperation")
            ca = op.campaign_asset_operation.create
            ca.campaign = campaign_res
            ca.asset = assets[name]
            ca.field_type = client.enums.AssetFieldTypeEnum.SITELINK
            ops.append(op)

    if not ops:
        print("\nNothing to do.")
        return
    if args.dry_run:
        print("\n[dry run] %d operation(s) planned, nothing sent." % len(ops))
        return

    req = client.get_type("MutateGoogleAdsRequest")
    req.customer_id = CID
    req.mutate_operations.extend(ops)
    req.validate_only = args.validate
    try:
        res = ga.mutate(request=req)
    except GoogleAdsException as e:
        fail("Mutate", e)
    if args.validate:
        print("\n[validate only] Google accepted all %d operation(s); nothing was created."
              % len(ops))
        return
    print("\napplied %d operation(s)." % len(res.mutate_operation_responses))
    if not args.remove:
        print("Sitelinks go through policy review; check Assets > Sitelinks tomorrow for approval.")


if __name__ == "__main__":
    main()
