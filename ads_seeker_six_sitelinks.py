"""Brings the two seeker campaigns from 4 to 6 sitelinks (Google: "add at least six sitelinks to your campaigns", ads can then serve in the most prominent formats).

The owner campaigns already have 7 each; Metro-Seeker Intent and Other-Metro-Seeker Intent have 4 (Browse All Listings, Contact Owners Directly, New Listings Daily, Download the App). This links two EXISTING sitelink
assets that suit renters and carry no posting language: "Rent a Home" (/rent-lease, "no brokerage fee") and "Contact Us" (/contact). No new assets, nothing removed.

Run: python ads_seeker_six_sitelinks.py --dry-run | --validate | (apply) | --rollback   (rollback unlinks exactly these two from the two campaigns)
"""

import argparse

from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException

CID = "4214066478"
CAMPAIGNS = ["Metro-Seeker Intent", "Other-Metro-Seeker Intent"]
WANT = [("Rent a Home", "https://www.bhavano.com/rent-lease"), ("Contact Us", "https://www.bhavano.com/contact")]


def main():
    ap = argparse.ArgumentParser()
    mode = ap.add_mutually_exclusive_group()
    for m in ("dry-run", "validate", "rollback"):
        mode.add_argument("--" + m, action="store_true")
    args = ap.parse_args()
    client = make_client()
    ga = client.get_service("GoogleAdsService")
    names = ",".join("'%s'" % c for c in CAMPAIGNS)
    campaigns = {r.campaign.name: r.campaign.resource_name for r in ga.search(customer_id=CID, query=f"""
        SELECT campaign.name, campaign.resource_name FROM campaign WHERE campaign.name IN ({names}) AND campaign.status != 'REMOVED'""")}

    # the existing assets to reuse (any campaign's copy of the same text and URL)
    assets = {}
    for r in ga.search(customer_id=CID, query="""
        SELECT asset.resource_name, asset.sitelink_asset.link_text, asset.final_urls, campaign_asset.status, campaign_asset.field_type
        FROM campaign_asset WHERE campaign_asset.field_type = 'SITELINK' AND campaign_asset.status = 'ENABLED'"""):
        for text, url in WANT:
            if r.asset.sitelink_asset.link_text == text and list(r.asset.final_urls)[:1] == [url]:
                assets.setdefault((text, url), r.asset.resource_name)
    missing = [w for w in WANT if w not in assets]
    if missing:
        raise SystemExit("assets not found: %s" % missing)

    linked = {}
    for r in ga.search(customer_id=CID, query=f"""
        SELECT campaign.name, campaign_asset.resource_name, campaign_asset.asset, campaign_asset.status, campaign_asset.field_type FROM campaign_asset
        WHERE campaign.name IN ({names}) AND campaign_asset.field_type = 'SITELINK' AND campaign_asset.status = 'ENABLED'"""):
        linked[(r.campaign.name, r.campaign_asset.asset)] = r.campaign_asset.resource_name
    print("sitelinks now: " + ", ".join("%s %d" % (c, sum(1 for k in linked if k[0] == c)) for c in CAMPAIGNS))

    ops = []
    for c in CAMPAIGNS:
        for (text, url), asset in assets.items():
            key = (c, asset)
            if args.rollback:
                if key in linked:
                    op = client.get_type("MutateOperation")
                    op.campaign_asset_operation.remove = linked[key]
                    ops.append(op)
                    print("unlink %s from %s" % (text, c))
            elif key in linked:
                print("SKIP %s already on %s" % (text, c))
            else:
                op = client.get_type("MutateOperation")
                ca = op.campaign_asset_operation.create
                ca.campaign = campaigns[c]
                ca.asset = asset
                ca.field_type = client.enums.AssetFieldTypeEnum.SITELINK
                ops.append(op)
                print("link %s (%s) to %s" % (text, url, c))
    if args.dry_run or not ops:
        return
    request = client.get_type("MutateGoogleAdsRequest")
    request.customer_id = CID
    request.mutate_operations.extend(ops)
    request.validate_only = args.validate
    try:
        ga.mutate(request=request)
    except GoogleAdsException as e:
        raise SystemExit("mutate failed:\n%s" % "\n".join("  " + er.message for er in e.failure.errors))
    print("validated only - nothing changed (%d operations)" % len(ops) if args.validate else "done: %d operations" % len(ops))


if __name__ == "__main__":
    main()
