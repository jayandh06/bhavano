"""Replaces one "free"-only headline and one "free"-only description in each of the four RSA ad
copy sets used by the ad groups ads_free_keyword_performance.py flagged as free-mentioning, with
copy that keeps "free" but also sets the boost expectation. See that script's own findings: those
ad groups post at ~2x the rate of the rest of the account, but only ~half as many posters go on to
boost.

Google Ads does not allow editing an existing responsive search ad's headline/description text via
the API (confirmed live: IMMUTABLE_FIELD on every attempt) -- the only supported path is to create
a new ad with the swapped copy and pause the old one. So, per ad group, in this order:
  1. CREATE a new RSA in the same ad group: identical final_urls/path1/path2 and every other
     headline/description, with only the one target headline and one target description swapped.
  2. Only once that create succeeds, UPDATE the old ad's status to PAUSED (never removed -- it
     stays there to revert to). Sequential per ad group, not one big batch, so a create failure
     never leaves an ad group with its only ad paused and no replacement live.

Run: python ads_soften_free_copy.py --dry-run
     python ads_soften_free_copy.py
"""

import sys

from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException
from google.api_core import protobuf_helpers

CID = "4214066478"

NEW_HEADLINE = "Post Free, Boost To Sell"

# Exact live text -> exact replacement text. Headline en dash confirmed byte-for-byte via
# h.text.encode("utf-8").hex() -- it's U+2013, not U+2014, which a first attempt at this got wrong.
HEADLINE_REPLACEMENTS = {
    "Free Commercial Ad Posting": NEW_HEADLINE,
    "Bhavano.com – Post Free": NEW_HEADLINE,
    "Free Rental Ad Posting": NEW_HEADLINE,
    "Free Property Listing Site": NEW_HEADLINE,
}

DESCRIPTION_REPLACEMENTS = {
    "Create a free listing, add photos, and get discovered by serious buyers near you.":
        "List free, add photos, then boost your ad to reach buyers faster.",
    "Built for property owners. Create your free listing and start getting calls instantly.":
        "Free to post. Boost your ad anytime to get more calls, faster.",
    "Create a free rental listing, add photos, and get discovered by serious tenants fast.":
        "List free, then boost your ad to reach tenants faster.",
    "Post your property ad free on Bhavano.com. Reach genuine buyers directly, no broker fees.":
        "Free to post. Boost your ad to reach buyers even faster.",
}

FREE_AD_GROUP_IDS = {
    "199595834373", "198419903663", "196651916541", "200702632978",
    "200422013973", "200422014133", "201547741818", "198875640405",
}


def main():
    dry_run = "--dry-run" in sys.argv
    client = make_client()
    ga = client.get_service("GoogleAdsService")
    ad_group_ad_service = client.get_service("AdGroupAdService")

    rows = list(ga.search(customer_id=CID, query="""
        SELECT ad_group_ad.resource_name, ad_group.id, ad_group.resource_name, ad_group.name,
               campaign.name, ad_group_ad.status,
               ad_group_ad.ad.final_urls,
               ad_group_ad.ad.responsive_search_ad.headlines,
               ad_group_ad.ad.responsive_search_ad.descriptions,
               ad_group_ad.ad.responsive_search_ad.path1,
               ad_group_ad.ad.responsive_search_ad.path2
        FROM ad_group_ad
        WHERE ad_group_ad.status != 'REMOVED'
    """))

    def as_asset(text, pinned):
        asset = client.get_type("AdTextAsset")
        asset.text = text
        if pinned:
            asset.pinned_field = pinned
        return asset

    plans = []
    for r in rows:
        agid = str(r.ad_group.id)
        if agid not in FREE_AD_GROUP_IDS:
            continue

        rsa = r.ad_group_ad.ad.responsive_search_ad
        headline_changed = False
        description_changed = False
        new_headlines = []
        for h in rsa.headlines:
            replacement = HEADLINE_REPLACEMENTS.get(h.text)
            if replacement is not None:
                headline_changed = True
            new_headlines.append((replacement or h.text, h.pinned_field))
        new_descriptions = []
        for d in rsa.descriptions:
            replacement = DESCRIPTION_REPLACEMENTS.get(d.text)
            if replacement is not None:
                description_changed = True
            new_descriptions.append((replacement or d.text, d.pinned_field))

        if not headline_changed and not description_changed:
            print("  [%s] %s / %s -- no matching text found, skipped"
                  % (agid, r.campaign.name, r.ad_group.name))
            continue

        plans.append({
            "agid": agid,
            "campaign": r.campaign.name,
            "ad_group_name": r.ad_group.name,
            "ad_group_resource": r.ad_group.resource_name,
            "old_ad_resource": r.ad_group_ad.resource_name,
            "old_status": r.ad_group_ad.status.name,
            "final_urls": list(r.ad_group_ad.ad.final_urls),
            "path1": rsa.path1,
            "path2": rsa.path2,
            "headlines": new_headlines,
            "descriptions": new_descriptions,
        })

        print("=" * 90)
        print("[%s] %s / %s" % (agid, r.campaign.name, r.ad_group.name))
        print("  old ad (to pause): %s (currently %s)" % (r.ad_group_ad.resource_name, r.ad_group_ad.status.name))
        if headline_changed:
            print("  headline: -> %r" % NEW_HEADLINE)
        if description_changed:
            for d in rsa.descriptions:
                repl = DESCRIPTION_REPLACEMENTS.get(d.text)
                if repl:
                    print("  description:")
                    print("    - %r" % d.text)
                    print("    + %r" % repl)

    print("\n%d ad group(s) to update (create new + pause old)." % len(plans))
    if dry_run:
        print("--dry-run: nothing sent.")
        return
    if not plans:
        print("Nothing to do.")
        return

    for plan in plans:
        print("\n--- %s / %s ---" % (plan["campaign"], plan["ad_group_name"]))

        create_op = client.get_type("AdGroupAdOperation")
        create_op.create.ad_group = plan["ad_group_resource"]
        create_op.create.status = client.enums.AdGroupAdStatusEnum.ENABLED
        create_op.create.ad.final_urls.extend(plan["final_urls"])
        if plan["path1"]:
            create_op.create.ad.responsive_search_ad.path1 = plan["path1"]
        if plan["path2"]:
            create_op.create.ad.responsive_search_ad.path2 = plan["path2"]
        create_op.create.ad.responsive_search_ad.headlines.extend(
            as_asset(text, pinned) for text, pinned in plan["headlines"]
        )
        create_op.create.ad.responsive_search_ad.descriptions.extend(
            as_asset(text, pinned) for text, pinned in plan["descriptions"]
        )

        try:
            resp = ad_group_ad_service.mutate_ad_group_ads(customer_id=CID, operations=[create_op])
            new_resource = resp.results[0].resource_name
            print("  created:", new_resource)
        except GoogleAdsException as e:
            print("  CREATE FAILED, old ad left untouched:")
            for err in e.failure.errors:
                print("    error:", err.message)
            continue

        pause_op = client.get_type("AdGroupAdOperation")
        pause_op.update.resource_name = plan["old_ad_resource"]
        pause_op.update.status = client.enums.AdGroupAdStatusEnum.PAUSED
        client.copy_from(pause_op.update_mask, protobuf_helpers.field_mask(None, pause_op.update._pb))

        try:
            ad_group_ad_service.mutate_ad_group_ads(customer_id=CID, operations=[pause_op])
            print("  paused: ", plan["old_ad_resource"])
        except GoogleAdsException as e:
            print("  PAUSE FAILED -- new ad %s is live, old ad %s is still also live (not paused):"
                  % (new_resource, plan["old_ad_resource"]))
            for err in e.failure.errors:
                print("    error:", err.message)


if __name__ == "__main__":
    main()
