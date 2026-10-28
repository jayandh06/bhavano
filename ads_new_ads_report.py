"""Read-only report on the newest responsive search ads in the account: approval status, ad strength and performance since they were created.

"Newest" = ad ids above the highest id of the 27 ads that ads_remove_verified_claims.py replaced (Google hands out ad ids in increasing order, and there is no
created-date field on an ad). Nothing is changed.

Run: python ads_new_ads_report.py
"""

import json
import os
from collections import defaultdict

from ads_setup_conversions import make_client

CID = "4214066478"
HERE = os.path.dirname(os.path.abspath(__file__))


def main():
    client = make_client()
    ga = client.get_service("GoogleAdsService")

    backup = json.load(open(os.path.join(HERE, "ads_remove_verified_claims_backup.json"), encoding="utf8"))
    tail = lambda res: int(res.split("~")[-1])
    replacement_ids = {tail(a["new"]) for a in backup["ads"]}
    replaced_ids = {tail(a["old"]) for a in backup["ads"]}
    threshold = min(replacement_ids) - 1
    print("replacement ads from the 'verified' clean-up: %d (ids from %d)" % (len(replacement_ids), threshold + 1))

    rows = list(ga.search(customer_id=CID, query="""
        SELECT campaign.name, campaign.status, ad_group.name, ad_group.status, ad_group_ad.ad.id, ad_group_ad.status,
               ad_group_ad.policy_summary.approval_status, ad_group_ad.policy_summary.review_status, ad_group_ad.ad_strength,
               metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
        FROM ad_group_ad
        WHERE ad_group_ad.status != 'REMOVED' AND segments.date DURING LAST_30_DAYS"""))
    # ads with no traffic in the window are missing from a segmented query, so fetch the unsegmented list as well
    allrows = list(ga.search(customer_id=CID, query="""
        SELECT campaign.name, campaign.status, ad_group.name, ad_group.status, ad_group_ad.ad.id, ad_group_ad.status,
               ad_group_ad.policy_summary.approval_status, ad_group_ad.policy_summary.review_status, ad_group_ad.ad_strength
        FROM ad_group_ad WHERE ad_group_ad.status != 'REMOVED'"""))

    perf = defaultdict(lambda: [0, 0, 0, 0.0])
    for r in rows:
        p = perf[r.ad_group_ad.ad.id]
        p[0] += r.metrics.impressions
        p[1] += r.metrics.clicks
        p[2] += r.metrics.cost_micros
        p[3] += r.metrics.conversions

    new = [r for r in allrows if r.ad_group_ad.ad.id > threshold]
    cohorts = {
        "A. replacements of the 27 'verified' ads": [r for r in new if r.ad_group_ad.ad.id in replacement_ids],
        "B. other ads added since (keyword headlines, Star groups, seeker campaigns)": [r for r in new if r.ad_group_ad.ad.id not in replacement_ids],
        "C. the 27 ads they replaced (old text)": [r for r in allrows if r.ad_group_ad.ad.id in replaced_ids],
    }
    total_new = len(new)
    print("ads in account (not removed): %d, added since the clean-up: %d\n" % (len(allrows), total_new))

    for name, group in cohorts.items():
        st = defaultdict(int)
        for r in group:
            st[(r.ad_group_ad.status.name, r.ad_group_ad.policy_summary.approval_status.name)] += 1
        strength = defaultdict(int)
        for r in group:
            strength[r.ad_group_ad.ad_strength.name] += 1
        t = [0, 0, 0, 0.0]
        for r in group:
            p = perf.get(r.ad_group_ad.ad.id, [0, 0, 0, 0.0])
            for j in range(4):
                t[j] += p[j]
        print("== %s: %d ads" % (name, len(group)))
        print("   status/approval:", dict(st))
        print("   ad strength:", dict(strength))
        ctr = 100.0 * t[1] / t[0] if t[0] else 0
        cpc = t[2] / 1e6 / t[1] if t[1] else 0
        cpa = t[2] / 1e6 / t[3] if t[3] else 0
        print("   last 30 days: impressions %d, clicks %d (CTR %.1f%%), cost Rs %.0f (CPC Rs %.1f), conversions %.1f (cost/conv Rs %.0f)\n" % (t[0], t[1], ctr, t[2] / 1e6, cpc, t[3], cpa))

    # enabled ads in enabled ad groups of enabled campaigns that have not been shown at all in 30 days
    quiet = [r for r in new if r.campaign.status.name == "ENABLED" and r.ad_group.status.name == "ENABLED" and r.ad_group_ad.status.name == "ENABLED"
             and perf.get(r.ad_group_ad.ad.id, [0])[0] == 0]
    print("new ads fully live but with 0 impressions in 30 days: %d" % len(quiet))
    for r in quiet:
        print("   %d  %s / %s" % (r.ad_group_ad.ad.id, r.campaign.name.encode("ascii", "replace").decode(), r.ad_group.name.encode("ascii", "replace").decode()))


if __name__ == "__main__":
    main()
