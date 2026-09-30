"""Read-only: does a "free" keyword/ad group convert to POSTING at a normal rate but to BOOSTING
at a much lower rate than the rest of the account?

Two GAQL queries, joined in Python by ad_group id:
  1. keyword_view -> which ad groups have an enabled keyword whose text contains "free".
  2. ad_group, segmented by segments.conversion_action_name and segments.date -> clicks and
     all_conversions per ad group per conversion action, since 2026-09-20 (the day the
     server-side purchase conversion actions in google-ads-conversion.provider.ts were created —
     comparing "Boost purchase" conversions from before that date would be meaningless, since
     nothing uploaded them yet).

Nothing here mutates. Run: python ads_free_keyword_performance.py
"""

import datetime

from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException

CID = "4214066478"
SINCE_DATE = "2026-09-20"  # PURCHASE_CONVERSION_ACTION_IDS created this day — see the doc comment
                           # on apps/bff/src/ads/google-ads-conversion.provider.ts. Comparing
                           # "Boost purchase" conversions from before this date is meaningless,
                           # since nothing uploaded them yet.
UNTIL_DATE = datetime.date.today().isoformat()  # GAQL needs a bounded segments.date range.
POST_ACTION_NAME = "Post ad success"
BOOST_ACTION_NAME = "Boost purchase"  # conversion_action.name for id 7781548730 (checked live —
                                      # google-ads-conversion.provider.ts's map key "listing_boost"
                                      # is just the internal PURCHASE_CONVERSION_ACTION_IDS key,
                                      # not the Ads-side display name).


def rows(client, ga, query):
    try:
        return list(ga.search(customer_id=CID, query=query))
    except GoogleAdsException as e:
        print("  query failed: %s" % (e.failure.errors[0].message if e.failure.errors else e))
        return []


def main():
    client = make_client()
    ga = client.get_service("GoogleAdsService")

    # 1. Which ad groups have an enabled keyword mentioning "free"?
    kw_rows = rows(client, ga, """
        SELECT ad_group.id, ad_group.name, campaign.name, ad_group_criterion.keyword.text
        FROM keyword_view
        WHERE ad_group_criterion.status = 'ENABLED'
    """)

    free_ad_groups = {}   # ad_group.id -> (campaign_name, ad_group_name, [matching keyword texts])
    all_ad_group_names = {}
    for r in kw_rows:
        agid = r.ad_group.id
        all_ad_group_names[agid] = (r.campaign.name, r.ad_group.name)
        text = r.ad_group_criterion.keyword.text
        if "free" in text.lower():
            entry = free_ad_groups.setdefault(agid, (r.campaign.name, r.ad_group.name, []))
            entry[2].append(text)

    print("=" * 90)
    print("AD GROUPS WITH AN ENABLED 'free' KEYWORD (%d of %d ad groups seen)"
          % (len(free_ad_groups), len(all_ad_group_names)))
    print("=" * 90)
    for agid, (camp, ag, kws) in free_ad_groups.items():
        print("  [%s] %s / %s" % (agid, camp, ag))
        for k in kws:
            print("        %r" % k)

    # 2a. Clicks per ad group, since SINCE_DATE (clicks isn't selectable alongside
    # segments.conversion_action_name in the same query — separate query, merged below).
    click_rows = rows(client, ga, """
        SELECT ad_group.id, ad_group.name, campaign.name, metrics.clicks
        FROM ad_group
        WHERE segments.date BETWEEN '%s' AND '%s'
          AND ad_group.status = 'ENABLED'
    """ % (SINCE_DATE, UNTIL_DATE))

    # ad_group.id -> {"clicks": float, "post": float, "boost": float, "other": float}
    agg = {}
    for r in click_rows:
        agid = r.ad_group.id
        agg.setdefault(agid, {"clicks": 0.0, "post": 0.0, "boost": 0.0, "other": 0.0})
        agg[agid]["clicks"] += r.metrics.clicks

    # 2b. all_conversions per ad group, segmented by conversion action, since SINCE_DATE.
    conv_rows = rows(client, ga, """
        SELECT ad_group.id, ad_group.name, campaign.name,
               segments.conversion_action_name, metrics.all_conversions
        FROM ad_group
        WHERE segments.date BETWEEN '%s' AND '%s'
          AND ad_group.status = 'ENABLED'
    """ % (SINCE_DATE, UNTIL_DATE))

    for r in conv_rows:
        agid = r.ad_group.id
        bucket = agg.setdefault(agid, {"clicks": 0.0, "post": 0.0, "boost": 0.0, "other": 0.0})
        name = r.segments.conversion_action_name
        conv = r.metrics.all_conversions
        if name == POST_ACTION_NAME:
            bucket["post"] += conv
        elif name == BOOST_ACTION_NAME:
            bucket["boost"] += conv
        elif conv:
            bucket["other"] += conv

    def summarize(label, ad_group_ids):
        clicks = sum(agg.get(i, {}).get("clicks", 0) for i in ad_group_ids)
        post = sum(agg.get(i, {}).get("post", 0) for i in ad_group_ids)
        boost = sum(agg.get(i, {}).get("boost", 0) for i in ad_group_ids)
        print("\n%s — %d ad group(s)" % (label, len(ad_group_ids)))
        print("  clicks:            %10.0f" % clicks)
        print("  post_ad_success:   %10.2f   (%.2f%% of clicks)" % (post, 100 * post / clicks if clicks else 0))
        print("  Boost purchase:    %10.2f   (%.2f%% of clicks, %.2f%% of posts)" % (
            boost,
            100 * boost / clicks if clicks else 0,
            100 * boost / post if post else 0,
        ))
        return clicks, post, boost

    print("\n" + "=" * 90)
    print("PERFORMANCE SINCE %s (segments.date, ad_group-level, all_conversions)" % SINCE_DATE)
    print("=" * 90)

    free_ids = set(free_ad_groups.keys())
    other_ids = set(all_ad_group_names.keys()) - free_ids

    summarize("FREE-mentioning ad groups", free_ids)
    summarize("Every other ad group", other_ids)

    print("\nPer ad group:")
    for agid in sorted(agg, key=lambda i: -agg[i]["clicks"]):
        camp, ag = all_ad_group_names.get(agid, ("?", "?"))
        tag = "FREE" if agid in free_ids else "    "
        b = agg[agid]
        boost_pct = 100 * b["boost"] / b["post"] if b["post"] else 0
        print("  %s [%s] %-28s / %-32s clicks=%-6.0f post=%-6.2f boost=%-6.2f (%.1f%% of posts)"
              % (tag, agid, camp[:28], ag[:32], b["clicks"], b["post"], b["boost"], boost_pct))


if __name__ == "__main__":
    main()
