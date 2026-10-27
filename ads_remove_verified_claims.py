"""Removes the unsupported word "verified" from live ad copy, sitelinks and the account callout.

Why: the product has no verified-only listings (docs/plans/metro-seeker-sitelinks.md records this), so "Verified Listings", "Reach Verified Tenants", "Browse verified flats..." are
claims we cannot back and can be disapproved as misleading. 27 ads that are serving now say it (Metro-Seeker 7, Metro-Rent Out 4, Metro-Sell 5, Metro-Lease 2, Other-Metro-Rent Out 4,
Other-Metro-Sell 5), 4 "Buy Property" sitelinks and the account callout "Verified Listings". Ads paused, in paused ad groups or in paused campaigns are left alone.

Google Ads cannot edit an ad's or a sitelink's text, so this works in TWO PHASES to avoid a gap while Google reviews the new text:
  1. (default) CREATE the replacement ads / sitelinks / callout and link them. Nothing old is touched yet.
  2. (--finish, run once Google has approved the new ones) PAUSE the old ads and UNLINK the old sitelinks / callout. Old ads are paused, never removed.
Run phase 2 only when `--status` shows the replacements APPROVED; --finish refuses to touch anything whose replacement is not approved.

Replacements: headlines "Reach Verified Tenants" -> "Reach Tenants In Your City", "Verified Rental Listings" -> "Owner-Posted Rental Listings", "Verified Sale Listings" -> "Owner-Posted Sale Listings",
"Get Verified Tenant Leads" -> "Get Tenant Enquiries Directly" and so on; in descriptions and sitelink lines the word is simply dropped ("Browse flats, houses and PGs for rent in Pune").
Callout "Verified Listings" -> "Owner-Posted Listings". Everything else in each ad (other texts, final URL, paths, pins) is copied unchanged.

Run: python ads_remove_verified_claims.py --dry-run     read-only, prints every replacement
     python ads_remove_verified_claims.py --validate    Google validates phase 1, nothing is created
     python ads_remove_verified_claims.py               phase 1
     python ads_remove_verified_claims.py --status      shows approval of the replacements
     python ads_remove_verified_claims.py --finish      phase 2
     python ads_remove_verified_claims.py --rollback    pauses the replacement ads and unlinks the replacement assets (old ones were never touched before --finish)
"""

import argparse
import json
import os
import re

from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException

CID = "4214066478"
BACKUP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ads_remove_verified_claims_backup.json")
V = re.compile(r"verif", re.I)

HEADLINES = {
    "Reach Verified Tenants": "Reach Tenants In Your City",
    "Reach Verified Buyers": "Reach Buyers In Your City",
    "Verified Rental Listings": "Owner-Posted Rental Listings",
    "Verified Sale Listings": "Owner-Posted Sale Listings",
    "Get Verified Tenant Leads": "Get Tenant Enquiries Directly",
    "Get Verified Buyer Leads": "Get Buyer Enquiries Directly",
    "Reach Verified PG Seekers": "Reach PG Seekers In Your City",
    "Reach Verified Land Buyers": "Reach Land Buyers In Your City",
}
NEW_CALLOUT = "Owner-Posted Listings"
OLD_CALLOUT = "Verified Listings"


def drop_word(text):
    t = re.sub(r"\b[Vv]erified\s+", "", text)
    t = re.sub(r"\s{2,}", " ", t).strip()
    return t[:1].upper() + t[1:] if t else t


def fix_headline(text):
    return HEADLINES.get(text) or drop_word(text)


def ascii_safe(t):
    return t.encode("ascii", "replace").decode()


def main():
    ap = argparse.ArgumentParser()
    mode = ap.add_mutually_exclusive_group()
    for m in ("dry-run", "validate", "status", "finish", "rollback"):
        mode.add_argument("--" + m, action="store_true")
    args = ap.parse_args()

    client = make_client()
    ga = client.get_service("GoogleAdsService")

    if args.status or args.finish or args.rollback:
        phase2(client, ga, args)
        return

    # --- ads
    ads = []
    for r in ga.search(customer_id=CID, query="""
        SELECT campaign.name, campaign.status, ad_group.name, ad_group.status, ad_group.resource_name, ad_group_ad.status, ad_group_ad.resource_name,
               ad_group_ad.ad.final_urls, ad_group_ad.ad.responsive_search_ad.headlines, ad_group_ad.ad.responsive_search_ad.descriptions,
               ad_group_ad.ad.responsive_search_ad.path1, ad_group_ad.ad.responsive_search_ad.path2
        FROM ad_group_ad WHERE campaign.status = 'ENABLED' AND ad_group.status = 'ENABLED' AND ad_group_ad.status = 'ENABLED'"""):
        a = r.ad_group_ad.ad.responsive_search_ad
        if not any(V.search(x.text) for x in list(a.headlines) + list(a.descriptions)):
            continue
        heads = [(fix_headline(h.text), h.pinned_field.name) for h in a.headlines]
        descs = [(drop_word(d.text), d.pinned_field.name) for d in a.descriptions]
        seen, dedup = set(), []
        for t, pin in heads:
            if t.lower() in seen:
                continue
            seen.add(t.lower())
            dedup.append((t, pin))
        ads.append(dict(campaign=r.campaign.name, group=r.ad_group.name, group_resource=r.ad_group.resource_name, old_ad=r.ad_group_ad.resource_name,
                        url=list(r.ad_group_ad.ad.final_urls)[0], path1=a.path1, path2=a.path2, headlines=dedup, descriptions=descs,
                        old_headlines=[h.text for h in a.headlines]))
    problems = []
    for x in ads:
        problems += ["%s: headline too long (%d): %s" % (x["campaign"], len(t), t) for t, _ in x["headlines"] if len(t) > 30]
        problems += ["%s: description too long (%d): %s" % (x["campaign"], len(t), t) for t, _ in x["descriptions"] if len(t) > 90]
        if len(x["headlines"]) < 3:
            problems.append("%s: fewer than 3 headlines" % x["campaign"])
        if any(V.search(t) for t, _ in x["headlines"] + x["descriptions"]):
            problems.append("%s: still says verified" % x["campaign"])
    if problems:
        raise SystemExit("not sending anything:\n  " + "\n  ".join(problems))

    # --- callout
    callout_old = next(((r.asset.resource_name, r.customer_asset.resource_name) for r in ga.search(customer_id=CID, query=f"""
        SELECT asset.resource_name, customer_asset.resource_name, asset.callout_asset.callout_text, customer_asset.status, customer_asset.field_type
        FROM customer_asset WHERE customer_asset.field_type = 'CALLOUT' AND customer_asset.status = 'ENABLED'""")
        if r.asset.callout_asset.callout_text == OLD_CALLOUT), None)
    # --- sitelinks
    sitelinks = []
    for r in ga.search(customer_id=CID, query="""
        SELECT campaign.name, campaign.status, campaign_asset.resource_name, campaign_asset.status, campaign_asset.field_type, asset.resource_name,
               asset.sitelink_asset.link_text, asset.sitelink_asset.description1, asset.sitelink_asset.description2, asset.final_urls
        FROM campaign_asset WHERE campaign_asset.field_type = 'SITELINK' AND campaign_asset.status = 'ENABLED' AND campaign.status = 'ENABLED'"""):
        s = r.asset.sitelink_asset
        if V.search(s.link_text + s.description1 + s.description2):
            sitelinks.append(dict(campaign=r.campaign.name, link=r.campaign_asset.resource_name, asset=r.asset.resource_name, text=s.link_text,
                                  d1=drop_word(s.description1), d2=drop_word(s.description2), urls=list(r.asset.final_urls)))

    print("ADS to replace: %d" % len(ads))
    by = {}
    for x in ads:
        by.setdefault(x["campaign"], []).append(x)
    for c, xs in sorted(by.items()):
        print("  %-42s %d ads" % (c[:42], len(xs)))
    changed = {}
    for x in ads:
        for t, _ in x["headlines"]:
            if t not in x["old_headlines"]:
                changed[t] = changed.get(t, 0) + 1
    print("  new headlines: " + "; ".join("%s (x%d)" % kv for kv in sorted(changed.items())))
    print("  sample description: %s" % ascii_safe(ads[0]["descriptions"][0][0]) if ads else "")
    print("CALLOUT: %s -> %s (%s)" % (OLD_CALLOUT, NEW_CALLOUT, "found" if callout_old else "NOT FOUND"))
    print("SITELINKS to replace: %d links on %s" % (len(sitelinks), ", ".join(sorted({s['campaign'][:24] for s in sitelinks}))))
    for s in sitelinks[:3]:
        print("   %s | %s | %s" % (s["text"], s["d1"], s["d2"]))
    if args.dry_run:
        return

    ad_group_ad_service = client.get_service("AdGroupAdService")
    asset_service = client.get_service("AssetService")
    ops, tags, temp = [], [], [-1]

    def add(op, tag):
        ops.append(op)
        tags.append(tag)

    for x in ads:
        op = client.get_type("MutateOperation")
        aga = op.ad_group_ad_operation.create
        aga.ad_group = x["group_resource"]
        aga.status = client.enums.AdGroupAdStatusEnum.ENABLED
        aga.ad.final_urls.append(x["url"])
        rsa = aga.ad.responsive_search_ad
        for text, pin in x["headlines"]:
            t = client.get_type("AdTextAsset")
            t.text = text
            if pin != "UNSPECIFIED":
                t.pinned_field = client.enums.ServedAssetFieldTypeEnum[pin]
            rsa.headlines.append(t)
        for text, pin in x["descriptions"]:
            t = client.get_type("AdTextAsset")
            t.text = text
            if pin != "UNSPECIFIED":
                t.pinned_field = client.enums.ServedAssetFieldTypeEnum[pin]
            rsa.descriptions.append(t)
        rsa.path1, rsa.path2 = x["path1"], x["path2"]
        add(op, ("ad", x["old_ad"], x["campaign"]))

    if callout_old:
        res = asset_service.asset_path(CID, temp[0])
        temp[0] -= 1
        op = client.get_type("MutateOperation")
        a = op.asset_operation.create
        a.resource_name = res
        a.callout_asset.callout_text = NEW_CALLOUT
        add(op, ("callout_asset", callout_old[0], callout_old[1]))
        op = client.get_type("MutateOperation")
        ca = op.customer_asset_operation.create
        ca.asset = res
        ca.field_type = client.enums.AssetFieldTypeEnum.CALLOUT
        add(op, ("callout_link", callout_old[1], ""))

    made_assets = {}
    campaign_resources = {r.campaign.name: r.campaign.resource_name for r in ga.search(customer_id=CID, query="""
        SELECT campaign.name, campaign.resource_name FROM campaign WHERE campaign.status = 'ENABLED'""")}
    for s in sitelinks:
        if s["asset"] not in made_assets:
            res = asset_service.asset_path(CID, temp[0])
            temp[0] -= 1
            made_assets[s["asset"]] = res
            op = client.get_type("MutateOperation")
            a = op.asset_operation.create
            a.resource_name = res
            a.final_urls.extend(s["urls"])
            a.sitelink_asset.link_text = s["text"]
            a.sitelink_asset.description1 = s["d1"]
            a.sitelink_asset.description2 = s["d2"]
            add(op, ("sitelink_asset", s["asset"], ""))
        op = client.get_type("MutateOperation")
        link = op.campaign_asset_operation.create
        link.campaign = campaign_resources[s["campaign"]]
        link.asset = made_assets[s["asset"]]
        link.field_type = client.enums.AssetFieldTypeEnum.SITELINK
        add(op, ("sitelink_link", s["link"], s["asset"]))

    request = client.get_type("MutateGoogleAdsRequest")
    request.customer_id = CID
    request.mutate_operations.extend(ops)
    request.validate_only = args.validate
    try:
        resp = ga.mutate(request=request)
    except GoogleAdsException as e:
        raise SystemExit("mutate failed:\n%s" % "\n".join(
            "  %s (%s)" % (er.message, er.location.field_path_elements[-1].field_name if er.location.field_path_elements else "-")
            for er in e.failure.errors))
    if args.validate:
        print("\nvalidated only - nothing created (%d operations)" % len(ops))
        return
    backup = dict(ads=[], callout=None, sitelink_assets=[], sitelink_links=[])
    for tag, r in zip(tags, resp.mutate_operation_responses):
        kind = tag[0]
        if kind == "ad":
            backup["ads"].append(dict(old=tag[1], new=r.ad_group_ad_result.resource_name, campaign=tag[2]))
        elif kind == "callout_asset":
            backup["callout"] = dict(old_asset=tag[1], old_link=tag[2], new_asset=r.asset_result.resource_name)
        elif kind == "callout_link":
            backup["callout"]["new_link"] = r.customer_asset_result.resource_name
        elif kind == "sitelink_asset":
            backup["sitelink_assets"].append(dict(old_asset=tag[1], new_asset=r.asset_result.resource_name))
        elif kind == "sitelink_link":
            backup["sitelink_links"].append(dict(old_link=tag[1], old_asset=tag[2], new_link=r.campaign_asset_result.resource_name))
    with open(BACKUP, "w", encoding="utf8") as f:
        json.dump(backup, f, indent=1)
    print("\nphase 1 done (%d operations). Old ads/sitelinks/callout are untouched. Wait for approval (--status), then --finish. Backup: %s" % (len(ops), BACKUP))


def phase2(client, ga, args):
    with open(BACKUP, encoding="utf8") as f:
        b = json.load(f)

    def ad_status(resource):
        r = next(iter(ga.search(customer_id=CID, query=f"""
            SELECT ad_group_ad.policy_summary.approval_status, ad_group_ad.status FROM ad_group_ad WHERE ad_group_ad.resource_name = '{resource}'""")), None)
        return (r.ad_group_ad.policy_summary.approval_status.name, r.ad_group_ad.status.name) if r else ("MISSING", "MISSING")

    def asset_status(resource):
        r = next(iter(ga.search(customer_id=CID, query=f"""
            SELECT asset.policy_summary.approval_status FROM asset WHERE asset.resource_name = '{resource}'""")), None)
        return r.asset.policy_summary.approval_status.name if r else "MISSING"

    ads = [(x, ad_status(x["new"])) for x in b["ads"]]
    callout = asset_status(b["callout"]["new_asset"]) if b.get("callout") else None
    sitelinks = [(x, asset_status(x["new_asset"])) for x in b["sitelink_assets"]]
    if args.status:
        from collections import Counter
        print("new ads:", dict(Counter(s[0] for _, s in ads)))
        print("new callout:", callout)
        print("new sitelinks:", dict(Counter(s for _, s in sitelinks)))
        return

    ops = []
    if args.rollback:
        for x, _ in ads:
            op = client.get_type("MutateOperation")
            u = op.ad_group_ad_operation.update
            u.resource_name = x["new"]
            u.status = client.enums.AdGroupAdStatusEnum.PAUSED
            op.ad_group_ad_operation.update_mask.paths.append("status")
            ops.append(op)
        if b.get("callout"):
            op = client.get_type("MutateOperation")
            op.customer_asset_operation.remove = b["callout"]["new_link"]
            ops.append(op)
        for x in b["sitelink_links"]:
            op = client.get_type("MutateOperation")
            op.campaign_asset_operation.remove = x["new_link"]
            ops.append(op)
    else:
        approved_sitelinks = {x["old_asset"] for x, s in sitelinks if s == "APPROVED"}
        for x, s in ads:
            if s[0] == "APPROVED" and s[1] == "ENABLED":
                op = client.get_type("MutateOperation")
                u = op.ad_group_ad_operation.update
                u.resource_name = x["old"]
                u.status = client.enums.AdGroupAdStatusEnum.PAUSED
                op.ad_group_ad_operation.update_mask.paths.append("status")
                ops.append(op)
            else:
                print("keeping the old ad (replacement %s/%s): %s" % (s[0], s[1], x["campaign"]))
        if b.get("callout") and callout == "APPROVED":
            op = client.get_type("MutateOperation")
            op.customer_asset_operation.remove = b["callout"]["old_link"]
            ops.append(op)
        for x in b["sitelink_links"]:
            if x["old_asset"] in approved_sitelinks:
                op = client.get_type("MutateOperation")
                op.campaign_asset_operation.remove = x["old_link"]
                ops.append(op)
    if not ops:
        print("nothing to do")
        return
    request = client.get_type("MutateGoogleAdsRequest")
    request.customer_id = CID
    request.mutate_operations.extend(ops)
    ga.mutate(request=request)
    print("%s: %d operations" % ("rolled back" if args.rollback else "phase 2 done", len(ops)))


if __name__ == "__main__":
    main()
