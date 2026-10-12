"""Replaces one headline + one description in 8 ads (4 ad-group types x Metro/Other-Metro).

Context: ads_soften_free_copy.py deliberately introduced "Post Free, Boost To Sell" and its
matching descriptions to fix a different problem - pure "free"-only headlines were pulling in
2x the posters but only half as many went on to pay for Boost, so the paid-upgrade mention was
added right next to "free" as an expectation-setter. This script keeps that expectation-setting
job but: (1) drops the now-redundant "Post Free"/"Free to post"/"List free" opener, since every
one of these ads already carries 2-3 *other* headlines saying "free" on their own - repeating it
here just primes resistance to the paid ask in the very next clause; (2) renames "Boost" to
"Featured," the product's actual user-facing name (BoostPlanSelector's own UI says "Feature this
ad", the badge says "Featured" - Boost is internal/code naming only); (3) fixes "...To Sell" being
wrongly reused verbatim in the Rent Out ad groups.

Google Ads does not allow editing an existing responsive search ad's headline/description text
via the API (IMMUTABLE_FIELD) - same constraint ads_soften_free_copy.py already hit. So, per ad,
in this order:
  1. CREATE a new RSA in the same ad group: identical final_urls/path1/path2 and every other
     headline/description, with only the one target headline and one target description swapped.
  2. Only once that create succeeds, UPDATE the old ad's status to PAUSED (never removed - stays
     there to revert to). Sequential per ad, not one big batch, so a create failure never leaves
     an ad group with its only ad paused and no replacement live.

Run: python ads_fix_boost_to_featured_copy.py --dry-run
     python ads_fix_boost_to_featured_copy.py
"""

import sys

from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException
from google.api_core import protobuf_helpers

CID = "4214066478"
DRY = "--dry-run" in sys.argv

# ad_id -> (old headline, new headline, old description, new description)
CHANGES = {
    "826468462278": (  # Metro-Generic Post Ad Intent
        "Post Free, Boost To Sell", "Feature Your Ad, Get Noticed",
        "Free to post. Boost your ad anytime to get more calls, faster.",
        "Feature your ad anytime to get more calls, faster.",
    ),
    "826475356989": (  # Other-Metro-Generic Post Ad Intent
        "Post Free, Boost To Sell", "Feature Your Ad, Get Noticed",
        "Free to post. Boost your ad anytime to get more calls, faster.",
        "Feature your ad anytime to get more calls, faster.",
    ),
    "826475351001": (  # Metro-Rent Out 2.1
        "Post Free, Boost To Sell", "Feature Your Ad To Rent",
        "List free, then boost your ad to reach tenants faster.",
        "Feature your ad to reach tenants faster.",
    ),
    "826475351445": (  # Other-Metro-Rent Out 2.1
        "Post Free, Boost To Sell", "Feature Your Ad To Rent",
        "List free, then boost your ad to reach tenants faster.",
        "Feature your ad to reach tenants faster.",
    ),
    "826514573029": (  # Metro-Sell 1.1
        "Post Free, Boost To Sell", "Feature Your Ad To Sell",
        "Free to post. Boost your ad to reach buyers even faster.",
        "Feature your ad to reach buyers even faster.",
    ),
    "826475343117": (  # Other-Metro-Sell 1.1
        "Post Free, Boost To Sell", "Feature Your Ad To Sell",
        "Free to post. Boost your ad to reach buyers even faster.",
        "Feature your ad to reach buyers even faster.",
    ),
    "826596888212": (  # Metro-Sell 1.5 Commercial
        "Post Free, Boost To Sell", "Feature Your Ad To Sell",
        "List free, add photos, then boost your ad to reach buyers faster.",
        "Add photos, then feature your ad to reach buyers faster.",
    ),
    "826475361252": (  # Other-Metro-Sell 1.5 Commercial
        "Post Free, Boost To Sell", "Feature Your Ad To Sell",
        "List free, add photos, then boost your ad to reach buyers faster.",
        "Add photos, then feature your ad to reach buyers faster.",
    ),
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

    ids = ", ".join("'%s'" % i for i in CHANGES)
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
        old_h, new_h, old_d, new_d = CHANGES[ad_id]
        rsa = r.ad_group_ad.ad.responsive_search_ad
        h_texts = [h.text for h in rsa.headlines]
        d_texts = [d.text for d in rsa.descriptions]
        if old_h not in h_texts:
            print("  SKIP   ad %s: headline not found (already changed?)" % ad_id)
            continue
        if old_d not in d_texts:
            print("  SKIP   ad %s: description not found (already changed?)" % ad_id)
            continue

        new_headlines = [(new_h if h.text == old_h else h.text, h.pinned_field) for h in rsa.headlines]
        new_descriptions = [(new_d if d.text == old_d else d.text, d.pinned_field) for d in rsa.descriptions]
        plans.append({
            "campaign": r.campaign.name, "ad_group": r.ad_group.name,
            "ad_group_resource": r.ad_group.resource_name,
            "old_ad_resource": r.ad_group_ad.resource_name,
            "final_urls": list(r.ad_group_ad.ad.final_urls),
            "path1": rsa.path1, "path2": rsa.path2,
            "headlines": new_headlines, "descriptions": new_descriptions,
            "old_h": old_h, "new_h": new_h, "old_d": old_d, "new_d": new_d,
        })
        print("  %s %-45s / %-35s ad %s" % ("valid " if DRY else "queue ", r.campaign.name[:45], r.ad_group.name[:35], ad_id))
        print("           headline:    \"%s\" -> \"%s\"" % (old_h, new_h))
        print("           description: \"%s\" -> \"%s\"" % (old_d, new_d))

    if DRY:
        print("\n[DRY RUN] %d ad(s) would get a new ad created + the old one paused. "
              "No live change made (no actual create was attempted)." % len(plans))
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
