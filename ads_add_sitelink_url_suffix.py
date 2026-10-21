"""Gives every sitelink asset the same Final URL suffix the campaigns carry, so a click on a sitelink is
attributed to its campaign and ad group in the admin Page visits table.

Why: the campaigns carry `gclid={gclid}&campaignid={campaignid}&adgroupid={adgroupid}&adid={creative}`
(docs/plans/capture-google-ads-click-attribution.md) and the site stores campaignid/adgroupid from it on each
Visit. Sitelink assets have their own final URLs and an empty suffix of their own, and about 8 of 1,200 ad-click
visits in the 14 days to 2026-10-21 landed on a sitelink URL ("/", "/post") with a click id but no campaign or ad
group (docs/plans/admin-page-visits-campaign-adgroup-names.md, update 2026-10-21). The final URLs are NOT touched,
only `final_url_suffix`, so no ad review is triggered.

Run: python ads_add_sitelink_url_suffix.py --dry-run     read-only, prints what would change
     python ads_add_sitelink_url_suffix.py --validate    Google validates the mutate, nothing is changed
     python ads_add_sitelink_url_suffix.py               applies it
"""

import argparse

from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException

CID = "4214066478"
SUFFIX = "gclid={gclid}&campaignid={campaignid}&adgroupid={adgroupid}&adid={creative}"


def main():
    p = argparse.ArgumentParser()
    mode = p.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true")
    mode.add_argument("--validate", action="store_true")
    args = p.parse_args()

    client = make_client()
    ga = client.get_service("GoogleAdsService")
    asset_service = client.get_service("AssetService")

    todo = []
    already = 0
    auto = 0
    for r in ga.search(customer_id=CID, query="""
        SELECT asset.id, asset.resource_name, asset.final_urls, asset.final_url_suffix,
               asset.sitelink_asset.link_text, asset.source
        FROM asset WHERE asset.type = 'SITELINK'"""):
        # Google-created sitelinks (AI Max / "text customization") cannot be edited by the advertiser.
        if r.asset.source.name != "ADVERTISER":
            auto += 1
            continue
        if r.asset.final_url_suffix == SUFFIX:
            already += 1
        elif r.asset.final_url_suffix:
            print("SKIP (has a different suffix already):", r.asset.id, repr(r.asset.final_url_suffix))
        else:
            todo.append(r.asset)
    print("sitelink assets: %d to update, %d already have the suffix, %d Google-created (not editable, skipped)" % (len(todo), already, auto))
    for a in todo[:60]:
        print("  %s  %-24s %s" % (a.id, a.sitelink_asset.link_text, list(a.final_urls)))
    if args.dry_run or not todo:
        return

    ops = []
    for a in todo:
        op = client.get_type("AssetOperation")
        op.update.resource_name = a.resource_name
        op.update.final_url_suffix = SUFFIX
        # Explicit mask: only the suffix changes, never the final URLs or link text.
        op.update_mask.paths.append("final_url_suffix")
        ops.append(op)
    try:
        request = client.get_type("MutateAssetsRequest")
        request.customer_id = CID
        request.operations.extend(ops)
        request.validate_only = args.validate
        resp = asset_service.mutate_assets(request=request)
    except GoogleAdsException as e:
        raise SystemExit("mutate failed:\n%s" % "\n".join(
            "  %s" % er.message for er in e.failure.errors))
    print("validated only - nothing changed" if args.validate else "updated %d assets" % len(resp.results))


if __name__ == "__main__":
    main()
