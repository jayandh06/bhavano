"""Adds owner-intent image assets to the Search campaigns.

Plan and reasoning: docs/plans/google-ads-image-assets.md. Images come from
marketing/google-ads/images/out/ (built by make_ad_images.py). Each image is linked at campaign
level as AD_IMAGE, in both the Metro and Other-Metro copy of its campaign.

Rolled out in waves so it doesn't overlap the second-ad test on Lease / Rent Out Commercial
(runs to ~2026-10-12): wave 1 = Generic Post Ad Intent + Sell, wave 2 = Rent Out + Lease.

Assets are created and linked in ONE GoogleAdsService.mutate using temporary (negative) asset
ids, so --validate checks the whole change end to end without creating anything, and a real
run either fully applies or not at all. Image assets are named bhavano-<image>-<ratio>; any
already in the account are reused rather than uploaded twice.

Run: python ads_image_assets.py --wave 1 --dry-run     read-only, prints the plan
     python ads_image_assets.py --wave 1 --validate    Google validates, nothing is created
     python ads_image_assets.py --wave 1               applies
     python ads_image_assets.py --wave 1 --remove      unlinks this script's images (rollback;
                                                       the assets stay in the library)
"""

import argparse
from pathlib import Path

from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException

CID = "4214066478"
OUT = Path(__file__).parent / "marketing" / "google-ads" / "images" / "out"
RATIOS = ("landscape", "square")

# Campaign name without its "Metro-" / "Other-Metro-" prefix -> images for it.
WAVES = {
    1: {
        "Generic Post Ad Intent": [
            "generic-owner-posting-phone",
            "generic-couple-photographing-room",
            "generic-phone-at-window",
        ],
        "Sell Property (Owners/Agents)": [
            "sell-family-outside-house",
            "sell-handshake-keys-documents",
            "sell-owner-photographing-balcony",
        ],
    },
    2: {},
}
TIERS = ("Metro-", "Other-Metro-")


def asset_name(image: str, ratio: str) -> str:
    return "bhavano-%s-%s" % (image, ratio)


def fail(what, e):
    errs = e.failure.errors
    raise SystemExit("%s failed:\n%s" % (what, "\n".join(
        "  %s (%s)" % (er.message, er.location.field_path_elements[-1].field_name
                       if er.location.field_path_elements else "-") for er in errs) or e))


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--wave", type=int, choices=sorted(WAVES), required=True)
    mode = p.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true")
    mode.add_argument("--validate", action="store_true")
    p.add_argument("--remove", action="store_true")
    args = p.parse_args()

    plan = WAVES[args.wave]
    if not plan:
        raise SystemExit("Wave %d has no images yet." % args.wave)

    client = make_client()
    ga = client.get_service("GoogleAdsService")

    def rows(query):
        return list(ga.search(customer_id=CID, query=query))

    campaigns = {r.campaign.name: r.campaign.resource_name for r in rows(
        "SELECT campaign.name, campaign.resource_name FROM campaign "
        "WHERE campaign.status != 'REMOVED' AND campaign.advertising_channel_type = 'SEARCH'")}
    targets = []  # (campaign name, campaign resource, [images])
    for base, images in plan.items():
        for tier in TIERS:
            name = tier + base
            if name not in campaigns:
                raise SystemExit("Campaign not found: %s" % name)
            targets.append((name, campaigns[name], images))

    linked = {}  # (campaign resource, asset name) -> campaign_asset resource
    for r in rows(
        "SELECT campaign.resource_name, campaign_asset.resource_name, asset.name "
        "FROM campaign_asset WHERE campaign_asset.field_type = 'AD_IMAGE' "
        "AND campaign_asset.status != 'REMOVED'"
    ):
        linked[(r.campaign.resource_name, r.asset.name)] = r.campaign_asset.resource_name

    tag = "   [DRY RUN]" if args.dry_run else "   [VALIDATE ONLY]" if args.validate else ""
    print("Account %s, wave %d%s\n" % (CID, args.wave, tag))

    ops = []
    if args.remove:
        wanted = {asset_name(i, r) for _, _, imgs in targets for i in imgs for r in RATIOS}
        for name, res, _ in targets:
            drop = [rn for (c, a), rn in linked.items() if c == res and a in wanted]
            print("%s: unlink %d image(s)" % (name, len(drop)))
            for rn in drop:
                op = client.get_type("MutateOperation")
                op.campaign_asset_operation.remove = rn
                ops.append(op)
    else:
        existing = {r.asset.name: r.asset.resource_name for r in rows(
            "SELECT asset.name, asset.resource_name FROM asset "
            "WHERE asset.type = 'IMAGE' AND asset.name LIKE 'bhavano-%'")}
        needed = sorted({asset_name(i, r) for _, _, imgs in targets for i in imgs for r in RATIOS})
        assets = {}
        temp_id = -1
        for an in needed:
            if an in existing:
                assets[an] = existing[an]
                print("reuse   %s" % an)
                continue
            image, ratio = an[len("bhavano-"):].rsplit("-", 1)
            path = OUT / ("%s-%s.jpg" % (image, ratio))
            if not path.exists():
                raise SystemExit("Missing %s; run marketing/google-ads/images/make_ad_images.py"
                                 % path)
            rn = "customers/%s/assets/%d" % (CID, temp_id)
            temp_id -= 1
            op = client.get_type("MutateOperation")
            a = op.asset_operation.create
            a.resource_name = rn
            a.name = an
            a.type_ = client.enums.AssetTypeEnum.IMAGE
            a.image_asset.data = path.read_bytes()
            ops.append(op)
            assets[an] = rn
            print("upload  %s  (%d KB)" % (an, path.stat().st_size // 1024))
        print()
        for name, res, images in targets:
            new = [asset_name(i, r) for i in images for r in RATIOS
                   if (res, asset_name(i, r)) not in linked]
            print("%s: link %d image(s)%s" % (name, len(new), "" if new else " (already linked)"))
            for an in new:
                op = client.get_type("MutateOperation")
                ca = op.campaign_asset_operation.create
                ca.campaign = res
                ca.asset = assets[an]
                ca.field_type = client.enums.AssetFieldTypeEnum.AD_IMAGE
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
        print("\n[validate only] Google accepted all %d operation(s); nothing was created." % len(ops))
        return
    print("\napplied %d operation(s)." % len(res.mutate_operation_responses))
    if not args.remove:
        print("Images go through policy review; check Assets > Images tomorrow for approval.")


if __name__ == "__main__":
    main()
