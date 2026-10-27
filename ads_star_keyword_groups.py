"""Gives your top-earning keywords an ad group of their own, with an ad written for exactly that keyword.

Why (docs/plans/google-ads-keyword-audit-2026-10.md, "Star keyword ad groups, 2026-10-27"): the biggest earners sit in large mixed ad groups whose ads cannot match each keyword exactly, and several score below average on
ad relevance. One keyword per ad group is a bad idea for a whole account (not enough data per group), but it is worth it for the few keywords that carry the conversions.

Each star group is created in the SAME campaign as the original, holds one keyword (same text and match type as the original) and one new responsive ad that mirrors it. The ORIGINAL keyword stays enabled in its old ad group for a
14-day comparison: Google serves one ad per search, so the two compete and the better one wins. Pause the loser afterwards (keywords are never removed here).
The home page's posting card follows the ad group id (apps/web/src/lib/adLandingCard.ts), so the printed ids must be added to AD_GROUP_INTENTS (the script prints the intent of the original group to copy).

Run: python ads_star_keyword_groups.py --dry-run     read-only, prints every group and ad and checks every length
     python ads_star_keyword_groups.py --validate    Google validates the batch, nothing is created
     python ads_star_keyword_groups.py               creates the groups, keywords and ads
     python ads_star_keyword_groups.py --rollback    PAUSES the star ad groups (found by name), never removes
"""

import argparse

from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException

CID = "4214066478"
PREFIX = "Star - "

COMMON_DESCS_RENT = [
    "List your flat, house, PG or room for rent in 2 minutes. Add photos from your phone.",
    "Zero platform fees to post. Reach tenants searching for homes in your city.",
    "Free to post, no commission. Upgrade to Featured later for more views.",
]
COMMON_DESCS_SALE = [
    "India's property listing site. Post to sell, rent or lease in 2 minutes, free.",
    "Zero platform fees to post. Reach buyers searching in your city.",
    "Free to post, no commission. Upgrade to Featured later for more views.",
]

# keyword -> (campaigns, base ad group prefix, headlines <= 30, descriptions <= 90, path2)
STARS = [
    ("best place to list apartment for rent", ["Metro-Rent Out Property (Owners)"], "ad group 2.1",
     ["Best Place To List Apartment", "List Your Apartment For Rent", "Best Place To List Flat", "Best Place To Rent Out Flat",
      "Apartment For Rent Listing", "List Apartment For Rent Online", "Rent Out Your Apartment Fast", "Tenants Contact You Directly",
      "No Brokerage, Direct Tenants", "Post Rental Ad In 2 Minutes", "Add Photos From Your Phone", "Rental Ads On Bhavano.com"],
     ["List your apartment for rent on Bhavano.com. No broker, tenants message you directly."] + COMMON_DESCS_RENT, "list-apartment"),
    ("free property listing site", ["Metro-Sell Property (Owners/Agents)", "Other-Metro-Sell Property (Owners/Agents)"], "ad group 1.1",
     ["Free Property Listing Site", "Free Property Listing Website", "List Property Free Online", "Free Listing For Owners",
      "Post Property Listing Free", "Sell, Rent Or Lease Free", "No Brokerage Listing Site", "Buyers Contact You Directly",
      "Post Ad In 2 Minutes", "Property Listing Site India", "Add Photos From Your Phone", "Free Real Estate Listings"],
     ["List your property free on Bhavano.com. No broker, buyers and tenants message you."] + COMMON_DESCS_SALE, "free-listing"),
    ("post rental property for free", ["Metro-Rent Out Property (Owners)", "Other-Metro-Rent Out Property (Owners)"], "ad group 2.1",
     ["Post Rental Property Free", "Post Your Rental Property Free", "Free Rental Property Listing", "List Rental Property For Free",
      "Post Rental Ad For Free", "Rent Out Property Free", "Tenants Contact You Directly", "No Brokerage, Direct Tenants",
      "Post Ad In 2 Minutes", "Add Photos From Your Phone", "Free Ads For Rent Owners", "Rental Ads On Bhavano.com"],
     ["Post your rental property free on Bhavano.com. No broker, tenants message you directly."] + COMMON_DESCS_RENT, "post-rental"),
    ("free property ads posting sites", ["Metro-Generic Post Ad Intent", "Other-Metro-Generic Post Ad Intent"], "ad group 1",
     ["Free Property Ads Posting Site", "Post Property Ads Free", "Free Real Estate Ads Posting", "Property Ads For Owners",
      "Advertise Property For Free", "Post Ad In 2 Minutes", "Sell, Rent Or Lease Free", "No Brokerage Listing Site",
      "Reach Buyers & Tenants", "Zero Fee Property Ads", "Free Property Listing Site", "Add Photos From Your Phone"],
     ["Post your property ad free on Bhavano.com. Zero platform fees, no broker, genuine leads."] + COMMON_DESCS_SALE, "free-ads-site"),
    ("post free ad for rent", ["Metro-Generic Post Ad Intent"], "ad group 1",
     ["Post Free Ad For Rent", "Post Free Rental Ad", "Free Ad For House Rent", "Free Ad For Flat On Rent",
      "Advertise Rentals For Free", "List Property For Rent Free", "Free Rent Ads Posting Site", "No Brokerage, Direct Tenants",
      "Tenants Contact You Directly", "Post Rental Ad In 2 Minutes", "Add Photos From Your Phone", "Rental Ads On Bhavano.com"],
     ["Post your rental ad free on Bhavano.com. No broker, tenants message you directly."] + COMMON_DESCS_RENT, "free-rent-ad"),
]


def check():
    out = []
    for kw, _, _, heads, descs, p2 in STARS:
        out += ["%s: headline too long (%d): %s" % (kw, len(h), h) for h in heads if len(h) > 30]
        out += ["%s: description too long (%d): %s" % (kw, len(d), d) for d in descs if len(d) > 90]
        if len({h.lower() for h in heads}) != len(heads):
            out.append("%s: duplicate headline" % kw)
        if len(p2) > 15:
            out.append("%s: path too long" % kw)
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
    if check():
        raise SystemExit("not sending anything:\n  " + "\n  ".join(check()))

    client = make_client()
    ga = client.get_service("GoogleAdsService")

    if args.rollback:
        ops = []
        for r in ga.search(customer_id=CID, query=f"""
            SELECT ad_group.resource_name, ad_group.name, ad_group.status FROM ad_group
            WHERE ad_group.name LIKE '{PREFIX}%' AND ad_group.status = 'ENABLED'"""):
            op = client.get_type("MutateOperation")
            u = op.ad_group_operation.update
            u.resource_name = r.ad_group.resource_name
            u.status = client.enums.AdGroupStatusEnum.PAUSED
            op.ad_group_operation.update_mask.paths.append("status")
            ops.append(op)
        if not ops:
            print("nothing to pause")
            return
        request = client.get_type("MutateGoogleAdsRequest")
        request.customer_id = CID
        request.mutate_operations.extend(ops)
        ga.mutate(request=request)
        print("paused %d star ad groups; nothing was removed" % len(ops))
        return

    campaigns = {}
    for r in ga.search(customer_id=CID, query="SELECT campaign.name, campaign.resource_name, campaign.status FROM campaign WHERE campaign.status = 'ENABLED'"):
        campaigns[r.campaign.name] = r.campaign.resource_name

    steps, skipped = [], []
    for kw, camps, prefix, heads, descs, p2 in STARS:
        for camp in camps:
            if camp not in campaigns:
                skipped.append("%s: campaign %s not enabled" % (kw, camp))
                continue
            groups = [(r.ad_group.name, r.ad_group.resource_name, r.ad_group.id, r.ad_group.cpc_bid_micros) for r in ga.search(customer_id=CID, query=f"""
                SELECT ad_group.name, ad_group.resource_name, ad_group.id, ad_group.cpc_bid_micros, ad_group.status FROM ad_group
                WHERE campaign.name = '{camp}' AND ad_group.status = 'ENABLED'""") if r.ad_group.name.lower().startswith(prefix)]
            if len(groups) != 1:
                skipped.append("%s: base ad group %r not unique in %s" % (kw, prefix, camp))
                continue
            gname, gres, gid, cpc = groups[0]
            if any(True for _ in ga.search(customer_id=CID, query=f"""
                    SELECT ad_group.name FROM ad_group WHERE campaign.name = '{camp}' AND ad_group.name = '{PREFIX}{kw}' AND ad_group.status != 'REMOVED'""")):
                skipped.append("%s / %s: star group already exists" % (kw, camp))
                continue
            base_kw = next(iter(ga.search(customer_id=CID, query=f"""
                SELECT ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, ad_group_criterion.status FROM ad_group_criterion
                WHERE ad_group.resource_name = '{gres}' AND ad_group_criterion.type = 'KEYWORD' AND ad_group_criterion.negative = FALSE
                  AND ad_group_criterion.status = 'ENABLED' AND ad_group_criterion.keyword.text = '{kw}'""")), None)
            if not base_kw:
                skipped.append("%s: keyword not enabled in the base ad group of %s" % (kw, camp))
                continue
            base_ad = next(iter(ga.search(customer_id=CID, query=f"""
                SELECT ad_group_ad.ad.final_urls, ad_group_ad.ad.responsive_search_ad.path1 FROM ad_group_ad
                WHERE ad_group.resource_name = '{gres}' AND ad_group_ad.status = 'ENABLED'""")), None)
            if not base_ad:
                skipped.append("%s: no enabled ad in the base ad group of %s" % (kw, camp))
                continue
            steps.append(dict(kw=kw, camp=camp, campaign=campaigns[camp], base_name=gname, base_id=gid, cpc=cpc,
                              match=base_kw.ad_group_criterion.keyword.match_type.name, url=list(base_ad.ad_group_ad.ad.final_urls)[0],
                              path1=base_ad.ad_group_ad.ad.responsive_search_ad.path1 or "post", heads=heads, descs=descs, p2=p2))
    for s in steps:
        print("STAR  %-34s %-42s [%s] copied from group %s (id %s)" % (s["kw"], s["camp"][:42], s["match"], ascii_safe(s["base_name"])[:30], s["base_id"]))
    for k in skipped:
        print("SKIP  " + k)
    print("\nstar ad groups to create: %d" % len(steps))
    if args.dry_run or not steps:
        return

    ad_group_service = client.get_service("AdGroupService")
    ops, temp = [], -1
    for s in steps:
        resource = ad_group_service.ad_group_path(CID, temp)
        temp -= 1
        op = client.get_type("MutateOperation")
        ag = op.ad_group_operation.create
        ag.resource_name = resource
        ag.name = PREFIX + s["kw"]
        ag.campaign = s["campaign"]
        ag.status = client.enums.AdGroupStatusEnum.ENABLED
        ag.type_ = client.enums.AdGroupTypeEnum.SEARCH_STANDARD
        if s["cpc"]:
            ag.cpc_bid_micros = s["cpc"]
        ops.append(op)
        op = client.get_type("MutateOperation")
        kw = op.ad_group_criterion_operation.create
        kw.ad_group = resource
        kw.status = client.enums.AdGroupCriterionStatusEnum.ENABLED
        kw.keyword.text = s["kw"]
        kw.keyword.match_type = client.enums.KeywordMatchTypeEnum[s["match"]]
        ops.append(op)
        op = client.get_type("MutateOperation")
        aga = op.ad_group_ad_operation.create
        aga.ad_group = resource
        aga.status = client.enums.AdGroupAdStatusEnum.ENABLED
        aga.ad.final_urls.append(s["url"])
        rsa = aga.ad.responsive_search_ad
        for text in s["heads"]:
            t = client.get_type("AdTextAsset")
            t.text = text
            rsa.headlines.append(t)
        for text in s["descs"]:
            t = client.get_type("AdTextAsset")
            t.text = text
            rsa.descriptions.append(t)
        rsa.path1, rsa.path2 = s["path1"], s["p2"]
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
    if args.validate:
        print("validated only - nothing created (%d operations)" % len(ops))
        return
    print("created %d star ad groups. New ids (add to adLandingCard.ts / campaign-names.ts):" % len(steps))
    for r in ga.search(customer_id=CID, query=f"""
        SELECT campaign.name, ad_group.id, ad_group.name FROM ad_group WHERE ad_group.name LIKE '{PREFIX}%' AND ad_group.status != 'REMOVED'"""):
        print("  %s  %s  %s" % (r.ad_group.id, r.campaign.name, r.ad_group.name))


if __name__ == "__main__":
    main()
