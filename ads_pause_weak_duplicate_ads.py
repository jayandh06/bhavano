"""Pauses the confirmed-weak ENABLED ad in two ad groups that were running two ads at once,
letting the stronger ad take all the traffic instead of splitting it.

  Metro-Lease Property / Ad Group 3.1 - Lease Commercial/Office
    pause ad 826597269995 (AVERAGE strength, 4 impr / 0 clicks / 0 conv in last 30 days)
    keep  ad 826514552365 (EXCELLENT strength, 43 impr / 7 clicks / 1 conv)

  Metro-Rent Out Property (Owners) / Ad Group 2.4 - Rent Out Commercial
    pause ad 826514578228 (AVERAGE strength, 91 impr / 4 clicks / 0 conv)
    keep  ad 826597076060 (GOOD strength, 157 impr / 19 clicks / 4 conv)

Lease 3.2 Residential deliberately excluded - its two ads are statistically tied (1
conversion each, both getting real traffic), not enough data to call either one weaker.

Pause, never remove - reversible, same rule as every other change in this account.

Run: python ads_pause_weak_duplicate_ads.py --dry-run   (validate_only: Google checks, nothing changes)
     python ads_pause_weak_duplicate_ads.py
"""

import sys

from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException
from google.api_core import protobuf_helpers

CID = "4214066478"
DRY = "--dry-run" in sys.argv

TO_PAUSE = [
    ("Metro-Lease Property", "Ad Group 3.1 — Lease Commercial/Office", "826597269995"),
    ("Metro-Rent Out Property (Owners)", "Ad Group 2.4 — Rent Out Commercial", "826514578228"),
]


def main():
    client = make_client()
    ga = client.get_service("GoogleAdsService")
    ada_svc = client.get_service("AdGroupAdService")
    enums = client.enums

    rows = list(ga.search(customer_id=CID, query="""
        SELECT campaign.name, ad_group.name, ad_group_ad.ad.id, ad_group_ad.status,
               ad_group_ad.resource_name
        FROM ad_group_ad
    """))
    by_id = {r.ad_group_ad.ad.id: r for r in rows}

    print("%s" % ("[DRY RUN]" if DRY else "[LIVE]"))
    ops = []
    for camp, ag, ad_id in TO_PAUSE:
        r = by_id.get(int(ad_id))
        if r is None:
            print("  SKIP   ad %s not found" % ad_id)
            continue
        if r.campaign.name != camp or r.ad_group.name != ag:
            print("  SKIP   ad %s found but in a different ad group (%s / %s) - not touching"
                  % (ad_id, r.campaign.name, r.ad_group.name))
            continue
        if r.ad_group_ad.status.name == "PAUSED":
            print("  ok     %s / %s ad %s already paused" % (camp, ag, ad_id))
            continue
        op = client.get_type("AdGroupAdOperation")
        op.update.resource_name = r.ad_group_ad.resource_name
        op.update.status = enums.AdGroupAdStatusEnum.PAUSED
        client.copy_from(op.update_mask, protobuf_helpers.field_mask(None, op.update._pb))
        ops.append(op)
        print("  %s %s / %s: pause ad %s" % ("valid " if DRY else "queue ", camp, ag, ad_id))

    if not ops:
        return

    try:
        resp = ada_svc.mutate_ad_group_ads(
            request={"customer_id": CID, "operations": ops, "validate_only": DRY})
        if DRY:
            print("\n[DRY RUN] Google validated %d pause operations - no live change made." % len(ops))
        else:
            print("\nPaused %d ad(s)." % len(resp.results))
    except GoogleAdsException as e:
        print("FAILED:")
        for err in e.failure.errors:
            print("  -", err.message)


if __name__ == "__main__":
    main()
