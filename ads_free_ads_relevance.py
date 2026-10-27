"""Adds a SECOND responsive ad that mirrors the "free" keywords to the six owner ad groups that have them, next to the existing ad, to improve AD RELEVANCE.

Why (docs/plans/google-ads-keyword-audit-2026-10.md, "Free keywords and ad relevance" and "Do free keywords hurt Featured purchases?"): landing page experience is average or above on
every scored keyword, but 31 of 79 keywords have below-average ad relevance, mostly keywords that say "free" served by ads that do not. The owner ads stopped saying "free" on
2026-09-30 / 10-12 so it would not prime resistance to the paid Featured upsell; re-measured on 2026-10-27 the share of posters who buy Featured is the same in ad groups with "free"
keywords (14.2% against 15.3%) and those groups produce 65% of Featured purchases. Posting is free today (every listing fee is 0), so the word is true.

Nothing is paused or removed, so it is reversible and the existing ad keeps serving as the control. Google rotates the two ads.
  Metro-Generic and Other-Metro-Generic, "Ad group 1"      -> "generic_free" ad (path /post/free-ads)
  Metro-Rent Out and Other-Metro-Rent Out, "Ad Group 2.1"  -> "rent_out_free" ad (path /post/rent-free)
  Metro-Sell and Other-Metro-Sell, "Ad Group 1.1"          -> "sale_free" ad (path /post/sale-free)
Final URL is copied from the group's enabled ad; the tracking suffix comes from the campaign. The home page's posting card follows the ad group id, which does not change.
Compare the two ads in each group by post and Featured-purchase conversions after 14 to 21 days, then pause the loser.

Run: python ads_free_ads_relevance.py --dry-run     read-only, prints every ad it would create and checks every length
     python ads_free_ads_relevance.py --validate    Google validates the whole batch, nothing is created
     python ads_free_ads_relevance.py               creates the ads
     python ads_free_ads_relevance.py --rollback    PAUSES the ads this script created (found by path), never removes
"""

import argparse

from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException

CID = "4214066478"

# (campaigns, ad group name prefix, copy key)
TARGETS = [
    (["Metro-Generic Post Ad Intent", "Other-Metro-Generic Post Ad Intent"], "ad group 1", "generic_free"),
    (["Metro-Rent Out Property (Owners)", "Other-Metro-Rent Out Property (Owners)"], "ad group 2.1", "rent_out_free"),
    (["Metro-Sell Property (Owners/Agents)", "Other-Metro-Sell Property (Owners/Agents)"], "ad group 1.1", "sale_free"),
]

# key -> (headlines <= 30 characters, descriptions <= 90, path1, path2)
COPY = {
    "generic_free": (
        ["Post Free Property Ads", "Free Property Ads Posting Site", "Free Real Estate Ads Posting", "Advertise Property For Free",
         "Post Free Ad For Rent Or Sale", "Free Property Listing Site", "List Property, Zero Fees", "No Brokerage Listing Site",
         "Property Ads For Owners", "Sell, Rent Or Lease Free", "Post Ad In 2 Minutes", "Reach Buyers & Tenants"],
        ["Post your property ad free on Bhavano.com. Zero platform fees, no broker, genuine leads.",
         "India's real estate classifieds. List to sell, rent or lease in 2 minutes, free.",
         "Free to post, no commission. Connect with buyers or tenants searching in your city.",
         "Post your ad free and upgrade to Featured later if you want more views."],
        "post", "free-ads",
    ),
    "rent_out_free": (
        ["Free Rental Listing Site", "Post Rental Property Free", "List Your Property For Rent", "Free Ads For Rent Owners",
         "Tenants Contact You Directly", "No Brokerage, Direct Tenants", "Post Free Rental Ad", "List Flat Or House Free",
         "Post Ad In 2 Minutes", "Rent Out Your Property Fast", "Rental Ads On Bhavano.com", "Add Photos From Your Phone"],
        ["Post your rental property free on Bhavano.com. No broker, tenants message you directly.",
         "List your flat, house, PG or room for rent in 2 minutes. Add photos from your phone.",
         "Zero platform fees to post. Reach tenants searching for homes in your city.",
         "Free to post, no commission. Upgrade to Featured later for more views."],
        "post", "rent-free",
    ),
    "sale_free": (
        ["Free Property Listing Site", "Post Free Property Ads", "Free Property Sale Ads", "Free Real Estate Ads",
         "Sell Your Property Free", "Free Ad To Sell Flat Or House", "Sell Directly, No Brokerage", "Buyers Contact You Directly",
         "Post Sale Ad In 2 Minutes", "Sell Plot, Flat Or House Free", "Free Listing On Bhavano.com", "Property Sale Ads Free"],
        ["Post your property sale ad free on Bhavano.com. No broker, buyers message you directly.",
         "Sell your flat, house, villa or plot. Add photos and details in 2 minutes.",
         "Zero platform fees to post. Reach buyers searching in your city.",
         "Free to post, no commission. Upgrade to Featured later for more views."],
        "post", "sale-free",
    ),
}
OUR_PATHS = tuple(c[3] for c in COPY.values())


def check_lengths():
    problems = []
    for name, (heads, descs, p1, p2) in COPY.items():
        problems += ["%s headline too long (%d): %s" % (name, len(h), h) for h in heads if len(h) > 30]
        problems += ["%s description too long (%d): %s" % (name, len(d), d) for d in descs if len(d) > 90]
        if len(p1) > 15 or len(p2) > 15:
            problems.append("%s path too long" % name)
        if len({h.lower() for h in heads}) != len(heads):
            problems.append("%s has a duplicate headline" % name)
    return problems


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

    if args.rollback:
        ops = []
        for r in ga.search(customer_id=CID, query="""
            SELECT ad_group_ad.resource_name FROM ad_group_ad
            WHERE ad_group_ad.status = 'ENABLED' AND ad_group_ad.ad.responsive_search_ad.path2 IN ('%s')""" % "','".join(OUR_PATHS)):
            op = client.get_type("MutateOperation")
            aga = op.ad_group_ad_operation.update
            aga.resource_name = r.ad_group_ad.resource_name
            aga.status = client.enums.AdGroupAdStatusEnum.PAUSED
            op.ad_group_ad_operation.update_mask.paths.append("status")
            ops.append(op)
        if not ops:
            print("nothing to pause")
            return
        request = client.get_type("MutateGoogleAdsRequest")
        request.customer_id = CID
        request.mutate_operations.extend(ops)
        ga.mutate(request=request)
        print("paused %d ads; nothing was removed" % len(ops))
        return

    steps = []
    for camps, prefix, copy in TARGETS:
        for camp in camps:
            groups = [(r.ad_group.name, r.ad_group.resource_name) for r in ga.search(customer_id=CID, query=f"""
                SELECT ad_group.name, ad_group.resource_name FROM ad_group
                WHERE campaign.name = '{camp}' AND campaign.status = 'ENABLED' AND ad_group.status = 'ENABLED'""")
                if r.ad_group.name.lower().startswith(prefix)]
            if len(groups) != 1:
                raise SystemExit("expected one ad group starting %r in %s, found %d" % (prefix, camp, len(groups)))
            name, resource = groups[0]
            ads = [(r.ad_group_ad.ad.responsive_search_ad.path2, list(r.ad_group_ad.ad.final_urls)) for r in ga.search(customer_id=CID, query=f"""
                SELECT ad_group_ad.ad.responsive_search_ad.path2, ad_group_ad.ad.final_urls FROM ad_group_ad
                WHERE ad_group.resource_name = '{resource}' AND ad_group_ad.status = 'ENABLED'""")]
            if any(p2 == COPY[copy][3] for p2, _ in ads):
                print("SKIP %s / %s: the %s ad already exists" % (camp, name.encode("ascii", "replace").decode(), copy))
                continue
            if not ads or not ads[0][1]:
                raise SystemExit("no enabled ad with a final URL in %s / %s" % (camp, name))
            steps.append(dict(camp=camp, name=name, resource=resource, copy=copy, url=ads[0][1][0], existing=len(ads)))

    for s in steps:
        h, d, p1, p2 = COPY[s["copy"]]
        print("NEW AD  %-42s / %-38s [%s] alongside %d existing ad(s) -> %s /%s/%s" % (
            s["camp"][:42], s["name"].encode("ascii", "replace").decode()[:38], s["copy"], s["existing"], s["url"], p1, p2))
    if steps:
        print("headlines (generic): " + " | ".join(COPY["generic_free"][0]))
    print("\nads to create: %d" % len(steps))
    if args.dry_run or not steps:
        return

    ops = []
    for s in steps:
        h, d, p1, p2 = COPY[s["copy"]]
        op = client.get_type("MutateOperation")
        aga = op.ad_group_ad_operation.create
        aga.ad_group = s["resource"]
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
        rsa.path1, rsa.path2 = p1, p2
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
