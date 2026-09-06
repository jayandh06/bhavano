"""Sets a Final URL suffix on every campaign so ad clicks carry Google Ads' own click-identifying
params, without touching individual ad group/ad Final URLs.

Step 4 of docs/plans/capture-google-ads-click-attribution.md — Part A. The web/bff side (Part B)
already reads gclid/campaignid/adgroupid/adid off the landing URL (apps/web/src/middleware.ts) and
threads them through to the Visit/User rows; this is what actually puts those params on the URL.

Idempotent: a campaign whose final_url_suffix already matches SUFFIX is left alone.

Run: python ads_set_final_url_suffix.py --dry-run
     python ads_set_final_url_suffix.py
"""

import sys

from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException
from google.api_core import protobuf_helpers

CID = "4214066478"
SUFFIX = "gclid={gclid}&campaignid={campaignid}&adgroupid={adgroupid}&adid={creative}"

DRY = "--dry-run" in sys.argv


def main():
    client = make_client()
    ga = client.get_service("GoogleAdsService")
    campaign_svc = client.get_service("CampaignService")

    def act(label, fn):
        if DRY:
            print("  WOULD  %s" % label)
            return
        try:
            fn()
            print("  done   %s" % label)
        except GoogleAdsException as e:
            msg = e.failure.errors[0].message if e.failure.errors else str(e)
            print("  FAILED %s -> %s" % (label, msg))
        except Exception as e:
            print("  FAILED %s -> %s: %s" % (label, type(e).__name__, e))

    print("Account %s%s\n" % (CID, "   [DRY RUN]" if DRY else ""))

    rows = list(ga.search(customer_id=CID, query="""
        SELECT campaign.resource_name, campaign.name, campaign.status, campaign.final_url_suffix
        FROM campaign
        ORDER BY campaign.name
    """))

    for r in rows:
        c = r.campaign
        if c.final_url_suffix == SUFFIX:
            print("  ok     %-30s already has the suffix" % c.name)
            continue

        def set_suffix(rn=c.resource_name):
            op = client.get_type("CampaignOperation")
            op.update.resource_name = rn
            op.update.final_url_suffix = SUFFIX
            client.copy_from(op.update_mask, protobuf_helpers.field_mask(None, op.update._pb))
            campaign_svc.mutate_campaigns(customer_id=CID, operations=[op])

        act("set final_url_suffix on %-30s (%s)" % (c.name, c.status.name), set_suffix)


if __name__ == "__main__":
    main()
