"""Improves AD RELEVANCE for the owner "free ad" keywords without touching what already works.

Why (docs/plans/google-ads-keyword-audit-2026-10.md, "Ad relevance, 2026-10-27"): landing page experience is average or above on every scored keyword, but 31 of 79 keywords
have below-average AD RELEVANCE, mostly Metro-Generic Post Ad "Ad group 1" (11 of 16). Its keywords say "free", "rent", "flat", "sale"; the one enabled ad says none of those
(the "free" ads were paused on purpose in the 2026-09-30 / 10-12 copy passes so that "free" would not prime resistance to the paid Featured upsell). Posting is free today
(all listing fees are 0), so the word is true. Decision (owner, 2026-10-27): allow "free" only where the keywords say it, and keep each ad's words close to its keywords.

What it does (nothing is removed or paused, so every change is reversible and the old setup keeps serving):
  1. Metro-Generic and Other-Metro-Generic "Ad group 1": adds a SECOND responsive ad that mirrors the keywords ("Post Free Property Ads", "Free Real Estate Ads Posting"...).
     Google rotates the two; the old ad stays enabled.
  2. New ad groups "Ad group 1R - Post Free Ad For Rent" and "Ad group 1S - Post Free Ad For Sale" in both campaigns, each with its own ad. They get COPIES of the
     rent-free / sale-free keywords that exist in Ad group 1 (phrase match, same text). The originals stay enabled for a 14-day comparison, so the best keywords (for example
     "post free ad for rent", QS 8, 6 conversions) are not reset. Whichever side loses is paused afterwards.
  3. Metro-Rent Out and Other-Metro-Rent Out "Ad Group 2.1": a second ad that mirrors "free rental listing sites", "post rental property for free", "list your property for rent".
Final URL, tracking suffix and bidding are inherited from the existing ads and campaigns. The home page's posting card follows the ad group id (apps/web/src/lib/adLandingCard.ts),
so the new ad group ids must be added there after this runs (the script prints them).

Run: python ads_free_ads_relevance.py --dry-run     read-only, prints every ad and ad group it would create, and checks every length
     python ads_free_ads_relevance.py --validate    Google validates the whole batch, nothing is created
     python ads_free_ads_relevance.py               creates everything
     python ads_free_ads_relevance.py --rollback    PAUSES everything this script created (found by name), never removes
"""

import argparse

from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException

CID = "4214066478"

GENERIC = ["Metro-Generic Post Ad Intent", "Other-Metro-Generic Post Ad Intent"]
RENT_OUT = ["Metro-Rent Out Property (Owners)", "Other-Metro-Rent Out Property (Owners)"]

AG_R = "Ad group 1R - Post Free Ad For Rent"
AG_S = "Ad group 1S - Post Free Ad For Sale"

# keywords copied (when they exist enabled in the campaign's Ad group 1) into the new ad groups
RENT_KEYWORDS = [
    "post free ad for rent", "free ad posting for rental property", "free ad posting for house rent", "post free rental ads online",
    "post free ad for flat on rent", "free advertising sites for rental property", "free ad posting sites for rental property",
    "free rent ads posting sites", "property rent advertise free", "post free apartment rental ads", "advertise rentals for free",
    "advertise rental property for free", "advertise apartment for rent free", "post free ads for room rent",
    "advertise room for rent for free", "advertise property to rent for free",
]
SALE_KEYWORDS = ["free ad posting for property sale", "post free ads for property sale", "advertise property for sale for free"]

# (headlines <= 30 characters, descriptions <= 90, path1, path2)
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
    "rent": (
        ["Post Free Ad For Rent", "Post Your Rental Ad Free", "Free Rental Property Ads", "Advertise Rentals For Free",
         "Free Ad For Flat On Rent", "Free Ad For House Rent", "List Property For Rent Free", "Free Rent Ads Posting Site",
         "No Brokerage, Direct Tenants", "Tenants Contact You Directly", "Post Rental Ad In 2 Minutes", "Rental Ads On Bhavano.com"],
        ["Post your rental ad free on Bhavano.com. No broker, tenants message you directly.",
         "List your flat, house, PG or room for rent in 2 minutes. Add photos from your phone.",
         "Zero platform fees to post. Reach tenants searching for homes in your city.",
         "Free to post, no commission. Upgrade to Featured later for more views."],
        "post", "rent-ad",
    ),
    "sale": (
        ["Post Free Ad For Property Sale", "Sell Your Property Free", "Free Property Sale Ads", "Advertise Property For Sale",
         "Free Ad To Sell Flat Or House", "Sell Directly, No Brokerage", "Buyers Contact You Directly", "Post Sale Ad In 2 Minutes",
         "Property Sale Ads Free", "Sell Plot, Flat Or House Free", "Free Listing On Bhavano.com", "List Your Property For Sale"],
        ["Post your property sale ad free on Bhavano.com. No broker, buyers message you directly.",
         "Sell your flat, house, villa or plot. Add photos and details in 2 minutes.",
         "Zero platform fees to post. Reach buyers searching in your city.",
         "Free to post, no commission. Upgrade to Featured later for more views."],
        "post", "sale-ad",
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
}


def check_lengths():
    problems = []
    for name, (heads, descs, p1, p2) in COPY.items():
        problems += ["%s headline too long (%d): %s" % (name, len(h), h) for h in heads if len(h) > 30]
        problems += ["%s description too long (%d): %s" % (name, len(d), d) for d in descs if len(d) > 90]
        if len(p1) > 15 or len(p2) > 15:
            problems.append("%s path too long" % name)
        if len(set(h.lower() for h in heads)) != len(heads):
            problems.append("%s has a duplicate headline" % name)
    return problems


def ascii_safe(text):
    return text.encode("ascii", "replace").decode()


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
    names = ",".join("'%s'" % c for c in GENERIC + RENT_OUT)

    campaigns = {r.campaign.name: r.campaign.resource_name for r in ga.search(customer_id=CID, query=f"""
        SELECT campaign.name, campaign.resource_name FROM campaign WHERE campaign.name IN ({names}) AND campaign.status != 'REMOVED'""")}
    if set(campaigns) != set(GENERIC + RENT_OUT):
        raise SystemExit("campaigns found: %s" % sorted(campaigns))

    groups = {}  # (campaign, ad group name) -> dict
    for r in ga.search(customer_id=CID, query=f"""
        SELECT campaign.name, ad_group.name, ad_group.resource_name, ad_group.status, ad_group.cpc_bid_micros FROM ad_group
        WHERE campaign.name IN ({names}) AND ad_group.status != 'REMOVED'"""):
        groups[(r.campaign.name, r.ad_group.name)] = dict(resource=r.ad_group.resource_name, status=r.ad_group.status.name,
                                                          cpc=r.ad_group.cpc_bid_micros)

    if args.rollback:
        rollback(client, ga, groups)
        return

    def find(campaign, prefix):
        hits = [(n, g) for (c, n), g in groups.items() if c == campaign and n.lower().startswith(prefix.lower())
                and n not in (AG_R, AG_S) and g["status"] != "REMOVED"]
        if len(hits) != 1:
            raise SystemExit("expected one ad group starting %r in %s, found %d" % (prefix, campaign, len(hits)))
        return hits[0]

    # keywords (enabled) and a template ad (final url) per base ad group
    plan = []  # steps: dict(kind='ad'|'group', ...)
    for camp in GENERIC:
        base_name, base = find(camp, "ad group 1")
        kws = {r.ad_group_criterion.keyword.text.lower() for r in ga.search(customer_id=CID, query=f"""
            SELECT ad_group_criterion.keyword.text FROM ad_group_criterion WHERE ad_group.resource_name = '{base['resource']}'
              AND ad_group_criterion.type = 'KEYWORD' AND ad_group_criterion.negative = FALSE AND ad_group_criterion.status = 'ENABLED'""")}
        url = next(u for r in ga.search(customer_id=CID, query=f"""
            SELECT ad_group_ad.ad.final_urls FROM ad_group_ad WHERE ad_group.resource_name = '{base['resource']}'
              AND ad_group_ad.status = 'ENABLED'""") for u in r.ad_group_ad.ad.final_urls)
        plan.append(dict(kind="ad", campaign=camp, group=base_name, resource=base["resource"], copy="generic_free", url=url))
        for ag_name, words, copy in ((AG_R, RENT_KEYWORDS, "rent"), (AG_S, SALE_KEYWORDS, "sale")):
            chosen = [w for w in words if w in kws]
            if (camp, ag_name) in groups:
                print("SKIP existing ad group %s in %s" % (ag_name, camp))
                continue
            if chosen:
                plan.append(dict(kind="group", campaign=camp, name=ag_name, keywords=chosen, copy=copy, url=url, cpc=base["cpc"]))
    for camp in RENT_OUT:
        base_name, base = find(camp, "ad group 2.1")
        url = next(u for r in ga.search(customer_id=CID, query=f"""
            SELECT ad_group_ad.ad.final_urls FROM ad_group_ad WHERE ad_group.resource_name = '{base['resource']}'
              AND ad_group_ad.status = 'ENABLED'""") for u in r.ad_group_ad.ad.final_urls)
        plan.append(dict(kind="ad", campaign=camp, group=base_name, resource=base["resource"], copy="rent_out_free", url=url))

    for s in plan:
        if s["kind"] == "ad":
            h, d, p1, p2 = COPY[s["copy"]]
            print("NEW AD   %-40s / %-40s [%s] -> %s  /%s/%s" % (s["campaign"][:40], ascii_safe(s["group"])[:40], s["copy"], s["url"], p1, p2))
            print("         H: " + " | ".join(h))
        else:
            h, d, p1, p2 = COPY[s["copy"]]
            print("NEW GROUP %-39s / %s  (%d keywords, ad [%s])" % (s["campaign"][:39], s["name"], len(s["keywords"]), s["copy"]))
            print("         keywords: " + ", ".join(s["keywords"]))
    print("\nsteps: %d ads/groups" % len(plan))
    if args.dry_run:
        return

    ad_group_service = client.get_service("AdGroupService")
    ops = []
    temp = [-1]

    def add_ad(ad_group_resource, copy, url):
        h, d, p1, p2 = COPY[copy]
        op = client.get_type("MutateOperation")
        aga = op.ad_group_ad_operation.create
        aga.ad_group = ad_group_resource
        aga.status = client.enums.AdGroupAdStatusEnum.ENABLED
        aga.ad.final_urls.append(url)
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

    for s in plan:
        if s["kind"] == "ad":
            add_ad(s["resource"], s["copy"], s["url"])
            continue
        resource = ad_group_service.ad_group_path(CID, temp[0])
        temp[0] -= 1
        op = client.get_type("MutateOperation")
        ag = op.ad_group_operation.create
        ag.resource_name = resource
        ag.name = s["name"]
        ag.campaign = campaigns[s["campaign"]]
        ag.status = client.enums.AdGroupStatusEnum.ENABLED
        ag.type_ = client.enums.AdGroupTypeEnum.SEARCH_STANDARD
        if s["cpc"]:
            ag.cpc_bid_micros = s["cpc"]
        ops.append(op)
        for text in s["keywords"]:
            op = client.get_type("MutateOperation")
            kw = op.ad_group_criterion_operation.create
            kw.ad_group = resource
            kw.status = client.enums.AdGroupCriterionStatusEnum.ENABLED
            kw.keyword.text = text
            kw.keyword.match_type = client.enums.KeywordMatchTypeEnum.PHRASE
            ops.append(op)
        add_ad(resource, s["copy"], s["url"])

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
    print("created (%d operations). New ad group ids:" % len(ops))
    for r in ga.search(customer_id=CID, query=f"""
        SELECT campaign.name, ad_group.id, ad_group.name FROM ad_group
        WHERE campaign.name IN ({names}) AND ad_group.name LIKE 'Ad group 1_ - %' AND ad_group.status != 'REMOVED'"""):
        print("  %s  %s  %s" % (r.ad_group.id, r.campaign.name, ascii_safe(r.ad_group.name)))


def rollback(client, ga, groups):
    """Pauses (never removes) the two new ad groups per Generic campaign, and the second ads this script added to the existing ad groups."""
    ops = []
    for (camp, name), g in groups.items():
        if name in (AG_R, AG_S) and g["status"] == "ENABLED":
            op = client.get_type("MutateOperation")
            ag = op.ad_group_operation.update
            ag.resource_name = g["resource"]
            ag.status = client.enums.AdGroupStatusEnum.PAUSED
            op.ad_group_operation.update_mask.paths.append("status")
            ops.append(op)
    paths = {c[3]: c for c in [(None, None, None, v[3]) for v in COPY.values()]}
    for r in ga.search(customer_id=CID, query="""
        SELECT ad_group_ad.resource_name, ad_group_ad.ad.responsive_search_ad.path2, ad_group_ad.status FROM ad_group_ad
        WHERE ad_group_ad.status = 'ENABLED' AND ad_group_ad.ad.responsive_search_ad.path2 IN ('free-ads', 'rent-free')"""):
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
    print("paused %d items (ad groups 1R/1S and the second ads); nothing was removed" % len(ops))


if __name__ == "__main__":
    main()
