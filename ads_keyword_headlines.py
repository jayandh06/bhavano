"""Adds keyword-mirroring ads to the owner ad groups where high-spend keywords use words that appear in NO headline of the group's ads.

Why (docs/plans/google-ads-keyword-audit-2026-10.md, "Keyword words missing from headlines, 2026-10-27"): ad relevance is Google's check of how closely the ad matches the keyword. Looking at live
keywords weighted by 30-day spend, the biggest gaps are exact words: "best place" (keyword "best place to list apartment for rent": cost 3,486, 25 conversions), "rental", "apartment", "advertise",
"classified", "property". This adds, per ad group, ONE new responsive ad that copies the group's main existing ad (with the "verified" claims already stripped, see ads_remove_verified_claims.py) and swaps its
last generic headlines for headlines that carry the missing words. Nothing is paused or removed: the existing ads keep serving and Google rotates.

A responsive ad group may have at most 3 enabled ads; groups already at 3 are skipped and reported (several are until ads_remove_verified_claims.py --finish pauses the old versions), so the script can be rerun later.
A rerun skips groups that already have this ad (path /post/kw-match).

Run: python ads_keyword_headlines.py --dry-run     read-only, prints per ad group the new headlines, the capacity and the words covered
     python ads_keyword_headlines.py --validate    Google validates the batch, nothing is created
     python ads_keyword_headlines.py               creates the ads
     python ads_keyword_headlines.py --rollback    pauses the ads this script created (found by their /post/kw-match path)
"""

import argparse

from ads_remove_verified_claims import drop_word, fix_headline
from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException

CID = "4214066478"
PATH2 = "kw-match"
FREE_PATHS = {"free-ads", "rent-free", "sale-free", PATH2}

# (campaign, ad group name prefix) -> new headlines carrying the missing words (<= 30 characters)
TARGETS = [
    (["Metro-Rent Out Property (Owners)", "Other-Metro-Rent Out Property (Owners)"], "ad group 2.1",
     ["Best Place To List Your Flat", "Best Place To Rent Property", "Post Rental Advertisement", "List Apartment For Rent Online"]),
    (["Metro-Generic Post Ad Intent", "Other-Metro-Generic Post Ad Intent"], "ad group 1",
     ["Advertise Rental Property", "Apartment Rental Ads", "House Rent Ads Posting", "Property Advertising Sites", "Post Real Estate Ads Online"]),
    (["Metro-Sell Property (Owners/Agents)", "Other-Metro-Sell Property (Owners/Agents)"], "ad group 1.1",
     ["Advertise Property For Sale", "Property Selling Website", "Sell House Or Flat Online"]),
    (["Metro-Sell Property (Owners/Agents)", "Other-Metro-Sell Property (Owners/Agents)"], "ad group 1.2",
     ["Apartment Classified Ads", "Sell Apartment Online", "Advertise Flat For Sale"]),
    (["Metro-Lease Property"], "ad group 3.2",
     ["Lease Your Apartment", "Lease My Apartment Online", "Lease House Or Flat Online"]),
    (["Metro-Rent Out Property (Owners)", "Other-Metro-Rent Out Property (Owners)"], "ad group 2.4",
     ["Rent Out Your Property", "Rent Out Shop Or Office", "Commercial Property For Rent"]),
]


def problems():
    out = []
    for _, _, heads in TARGETS:
        out += ["headline too long (%d): %s" % (len(h), h) for h in heads if len(h) > 30]
    return out


def ascii_safe(t):
    return t.encode("ascii", "replace").decode()


def main():
    ap = argparse.ArgumentParser()
    mode = ap.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true")
    mode.add_argument("--validate", action="store_true")
    mode.add_argument("--rollback", action="store_true")
    args = ap.parse_args()
    if problems():
        raise SystemExit("not sending anything:\n  " + "\n  ".join(problems()))

    client = make_client()
    ga = client.get_service("GoogleAdsService")

    if args.rollback:
        ops = []
        for r in ga.search(customer_id=CID, query=f"""
            SELECT ad_group_ad.resource_name, ad_group_ad.status FROM ad_group_ad
            WHERE ad_group_ad.status = 'ENABLED' AND ad_group_ad.ad.responsive_search_ad.path2 = '{PATH2}'"""):
            op = client.get_type("MutateOperation")
            u = op.ad_group_ad_operation.update
            u.resource_name = r.ad_group_ad.resource_name
            u.status = client.enums.AdGroupAdStatusEnum.PAUSED
            op.ad_group_ad_operation.update_mask.paths.append("status")
            ops.append(op)
        if not ops:
            print("nothing to pause")
            return
        request = client.get_type("MutateGoogleAdsRequest")
        request.customer_id = CID
        request.mutate_operations.extend(ops)
        ga.mutate(request=request)
        print("paused %d ads" % len(ops))
        return

    steps, skipped = [], []
    for camps, prefix, new_heads in TARGETS:
        for camp in camps:
            groups = [(r.ad_group.name, r.ad_group.resource_name) for r in ga.search(customer_id=CID, query=f"""
                SELECT ad_group.name, ad_group.resource_name, campaign.status, ad_group.status FROM ad_group
                WHERE campaign.name = '{camp}' AND campaign.status = 'ENABLED' AND ad_group.status = 'ENABLED'""")
                if r.ad_group.name.lower().startswith(prefix)]
            if len(groups) != 1:
                skipped.append("%s / %s: ad group not found or ambiguous" % (camp, prefix))
                continue
            name, resource = groups[0]
            ads = []
            for r in ga.search(customer_id=CID, query=f"""
                SELECT ad_group_ad.status, ad_group_ad.resource_name, ad_group_ad.ad.final_urls, ad_group_ad.ad.responsive_search_ad.headlines,
                       ad_group_ad.ad.responsive_search_ad.descriptions, ad_group_ad.ad.responsive_search_ad.path1, ad_group_ad.ad.responsive_search_ad.path2
                FROM ad_group_ad WHERE ad_group.resource_name = '{resource}' AND ad_group_ad.status = 'ENABLED'"""):
                a = r.ad_group_ad.ad.responsive_search_ad
                ads.append(dict(url=list(r.ad_group_ad.ad.final_urls)[0], path1=a.path1, path2=a.path2,
                                heads=[h.text for h in a.headlines], descs=[d.text for d in a.descriptions]))
            label = "%s / %s" % (camp, ascii_safe(name)[:30])
            if any(a["path2"] == PATH2 for a in ads):
                skipped.append(label + ": already has the keyword-match ad")
                continue
            if len(ads) >= 3:
                skipped.append(label + ": already has %d enabled ads (limit 3); rerun after ads_remove_verified_claims.py --finish" % len(ads))
                continue
            # base: the first enabled ad that is not one of our "free"/keyword-match ads
            base = next((a for a in ads if a["path2"] not in FREE_PATHS), None)
            if not base:
                skipped.append(label + ": no base ad")
                continue
            old = [fix_headline(h) for h in base["heads"]]
            have = {h.lower() for h in old}
            add = [h for h in new_heads if h.lower() not in have]
            keep = max(3, 15 - len(add))
            heads = old[:keep] + add
            descs = [drop_word(d) for d in base["descs"]]
            steps.append(dict(label=label, resource=resource, base=base, heads=heads, descs=descs, add=add, enabled=len(ads)))

    for s in steps:
        print("NEW AD  %-62s (group has %d enabled)  +%d headlines: %s" % (s["label"][:62], s["enabled"], len(s["add"]), "; ".join(s["add"])))
    for k in skipped:
        print("SKIP    " + k)
    print("\nads to create: %d" % len(steps))
    if args.dry_run or not steps:
        return

    ops = []
    for s in steps:
        op = client.get_type("MutateOperation")
        aga = op.ad_group_ad_operation.create
        aga.ad_group = s["resource"]
        aga.status = client.enums.AdGroupAdStatusEnum.ENABLED
        aga.ad.final_urls.append(s["base"]["url"])
        rsa = aga.ad.responsive_search_ad
        for text in s["heads"]:
            t = client.get_type("AdTextAsset")
            t.text = text
            rsa.headlines.append(t)
        for text in s["descs"]:
            t = client.get_type("AdTextAsset")
            t.text = text
            rsa.descriptions.append(t)
        rsa.path1, rsa.path2 = (s["base"]["path1"] or "post"), PATH2
        ops.append(op)
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
    print("validated only - nothing created (%d operations)" % len(ops) if args.validate else "created %d ads" % len(ops))


if __name__ == "__main__":
    main()
