"""Creates the 'Other-Metro-Seeker Intent' Google Ads campaign: seeker (renter / buyer) search ads for the four tier-2 cities that
have listings but were only in the Other-Metro poster campaigns (Ahmedabad, Coimbatore, Jaipur, Lucknow).

Plan and reasoning: docs/plans/seeker-intent-campaign.md ("Other-Metro-Seeker Intent"). It copies Metro-Seeker Intent, read live
from the account, so the two stay alike: Search network only (no partners, no Display), English, geo "presence" targeting, the
07:00-23:00 daily ad schedule, the campaign's Final URL suffix (click tracking) and its phrase-match negative keywords. (Its negative
brand list is not copied: the API refuses it on this campaign; add it in the Ads UI if wanted.) Own budget (not shared) and own bidding: Maximise clicks with a max CPC ceiling, like Metro-Seeker Intent since 2026-10-25.

What it creates, all in ONE batch with temporary ids (so --validate checks everything and a real run is all or nothing):
  - a budget, the campaign (PAUSED), the four location targets (geo targets copied from an Other-Metro poster campaign),
    language, ad schedule, negative keywords and the negative brand list
  - per city a Rent ad group (ENABLED) and a Buy ad group (PAUSED) copied from the Bengaluru Rent / Buy Seekers groups of
    Metro-Seeker Intent (keywords, one responsive search ad, final URL /<city>/rent-lease or /<city>/buy). The campaign is
    PAUSED, so nothing spends until it is enabled in the Ads UI.

Run: python ads_create_other_metro_seeker_campaign.py --dry-run     read-only, prints exactly what would be created
     python ads_create_other_metro_seeker_campaign.py --validate    Google validates the whole batch, nothing is created
     python ads_create_other_metro_seeker_campaign.py               creates it
"""

import argparse

from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException

CID = "4214066478"
NEW_CAMPAIGN = "Other-Metro-Seeker Intent"
SOURCE_CAMPAIGN = "Metro-Seeker Intent"
LOCATION_SOURCE_CAMPAIGN = "Other-Metro-Generic Post Ad Intent"
BUDGET_MICROS = 200_000_000  # Rs 200 a day
CPC_CEILING_MICROS = 25_000_000  # Rs 25
TEMPLATE_CITY = "Bengaluru"
TEMPLATE_GROUPS = {"rent": "Rent Seekers", "buy": "Buy Seekers"}
# display name (ad text), keyword form (what people type), site slug (URL path + display path)
CITIES = [
    ("Ahmedabad", "ahmedabad", "ahmedabad"),
    ("Coimbatore", "coimbatore", "coimbatore"),
    ("Jaipur", "jaipur", "jaipur"),
    ("Lucknow", "lucknow", "lucknow"),
]
TRANSACTION_PATH = {"rent": "rent-lease", "buy": "buy"}
SITE = "https://www.bhavano.com"
STATUS = {"rent": "ENABLED", "buy": "PAUSED"}


def swap_text(text, display, keyword_form):
    """Template text -> city text. Title-case form for ad copy, lower-case form for keywords."""
    return text.replace(TEMPLATE_CITY, display).replace(TEMPLATE_CITY.lower(), keyword_form)


def ascii_safe(text):
    return text.encode("ascii", "replace").decode()


def main():
    p = argparse.ArgumentParser()
    mode = p.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true")
    mode.add_argument("--validate", action="store_true")
    args = p.parse_args()

    client = make_client()
    ga = client.get_service("GoogleAdsService")

    def one(query):
        rows = list(ga.search(customer_id=CID, query=query))
        return rows[0] if rows else None

    if one(f"SELECT campaign.id FROM campaign WHERE campaign.name = '{NEW_CAMPAIGN}' AND campaign.status != 'REMOVED'"):
        raise SystemExit("campaign '%s' already exists - not creating a second one" % NEW_CAMPAIGN)

    # --- the source campaign's settings, read live
    src = one(f"""SELECT campaign.final_url_suffix FROM campaign
                  WHERE campaign.name = '{SOURCE_CAMPAIGN}' AND campaign.status != 'REMOVED'""")
    if not src:
        raise SystemExit("source campaign not found")
    final_url_suffix = src.campaign.final_url_suffix

    language = one(f"""SELECT campaign_criterion.language.language_constant FROM campaign_criterion
                       WHERE campaign.name = '{SOURCE_CAMPAIGN}' AND campaign_criterion.type = 'LANGUAGE'""")
    language_constant = language.campaign_criterion.language.language_constant if language else "languageConstants/1000"

    schedules = [
        (r.campaign_criterion.ad_schedule.day_of_week, r.campaign_criterion.ad_schedule.start_hour,
         r.campaign_criterion.ad_schedule.start_minute, r.campaign_criterion.ad_schedule.end_hour,
         r.campaign_criterion.ad_schedule.end_minute)
        for r in ga.search(customer_id=CID, query=f"""
            SELECT campaign_criterion.ad_schedule.day_of_week, campaign_criterion.ad_schedule.start_hour,
                   campaign_criterion.ad_schedule.start_minute, campaign_criterion.ad_schedule.end_hour,
                   campaign_criterion.ad_schedule.end_minute
            FROM campaign_criterion WHERE campaign.name = '{SOURCE_CAMPAIGN}' AND campaign_criterion.type = 'AD_SCHEDULE'""")
    ]
    negatives = [
        (r.campaign_criterion.keyword.text, r.campaign_criterion.keyword.match_type)
        for r in ga.search(customer_id=CID, query=f"""
            SELECT campaign_criterion.keyword.text, campaign_criterion.keyword.match_type FROM campaign_criterion
            WHERE campaign.name = '{SOURCE_CAMPAIGN}' AND campaign_criterion.type = 'KEYWORD' AND campaign_criterion.negative = TRUE""")
    ]
    brand_lists = [
        r.campaign_criterion.brand_list.shared_set
        for r in ga.search(customer_id=CID, query=f"""
            SELECT campaign_criterion.brand_list.shared_set FROM campaign_criterion
            WHERE campaign.name = '{SOURCE_CAMPAIGN}' AND campaign_criterion.type = 'BRAND_LIST' AND campaign_criterion.negative = TRUE""")
    ]

    # --- location targets: the geo targets of the four cities, read from an Other-Metro poster campaign
    wanted = {c[0] for c in CITIES}
    source_geo = {
        r.campaign_criterion.location.geo_target_constant
        for r in ga.search(customer_id=CID, query=f"""
            SELECT campaign_criterion.location.geo_target_constant FROM campaign_criterion
            WHERE campaign.name = '{LOCATION_SOURCE_CAMPAIGN}' AND campaign_criterion.type = 'LOCATION'
              AND campaign_criterion.negative = FALSE""")
    }
    geo_names = {}
    resources = sorted(source_geo)
    for i in range(0, len(resources), 50):
        q = "SELECT geo_target_constant.resource_name, geo_target_constant.name FROM geo_target_constant WHERE geo_target_constant.resource_name IN (%s)" % ",".join(
            "'%s'" % x for x in resources[i:i + 50])
        for r in ga.search(customer_id=CID, query=q):
            geo_names[r.geo_target_constant.resource_name] = r.geo_target_constant.name
    locations = sorted((name, res) for res, name in geo_names.items() if name in wanted)
    if {n for n, _ in locations} != wanted:
        raise SystemExit("geo targets found for %s, wanted %s" % (sorted(n for n, _ in locations), sorted(wanted)))

    # --- ad group templates, read live from the Bengaluru groups
    existing = {}
    for r in ga.search(customer_id=CID, query=f"""
        SELECT ad_group.id, ad_group.name FROM ad_group
        WHERE campaign.name = '{SOURCE_CAMPAIGN}' AND ad_group.status != 'REMOVED'"""):
        existing[r.ad_group.name] = r.ad_group
    templates = {}
    for key, suffix in TEMPLATE_GROUPS.items():
        group = next((g for n, g in existing.items() if TEMPLATE_CITY in n and n.endswith(suffix)), None)
        if group is None:
            raise SystemExit("template ad group for %s %s not found" % (TEMPLATE_CITY, suffix))
        keywords = [
            (r.ad_group_criterion.keyword.text, r.ad_group_criterion.keyword.match_type)
            for r in ga.search(customer_id=CID, query=f"""
                SELECT ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type FROM ad_group_criterion
                WHERE ad_group.id = {group.id} AND ad_group_criterion.type = 'KEYWORD'
                  AND ad_group_criterion.negative = FALSE AND ad_group_criterion.status != 'REMOVED'""")
        ]
        ad = None
        for r in ga.search(customer_id=CID, query=f"""
            SELECT ad_group_ad.ad.responsive_search_ad.headlines, ad_group_ad.ad.responsive_search_ad.descriptions,
                   ad_group_ad.ad.responsive_search_ad.path1, ad_group_ad.ad.responsive_search_ad.path2
            FROM ad_group_ad WHERE ad_group.id = {group.id} AND ad_group_ad.status != 'REMOVED'"""):
            ad = r.ad_group_ad.ad.responsive_search_ad
        if ad is None or not keywords:
            raise SystemExit("template %s has no ad or keywords" % ascii_safe(group.name))
        templates[key] = {
            "name": group.name,
            "keywords": keywords,
            "headlines": [h.text for h in ad.headlines],
            "descriptions": [d.text for d in ad.descriptions],
            "path1": ad.path1,
        }

    # --- the ad group plan, with length checks
    plan = []
    problems = []
    for display, keyword_form, slug in CITIES:
        for key in ("rent", "buy"):
            t = templates[key]
            headlines = [swap_text(h, display, keyword_form) for h in t["headlines"]]
            descriptions = [swap_text(d, display, keyword_form) for d in t["descriptions"]]
            problems += ["headline too long (%d): %s" % (len(h), h) for h in headlines if len(h) > 30]
            problems += ["description too long (%d): %s" % (len(d), d) for d in descriptions if len(d) > 90]
            if len(slug) > 15:
                problems.append("display path too long: " + slug)
            plan.append({
                "name": swap_text(t["name"], display, keyword_form),
                "status": STATUS[key],
                "keywords": [(swap_text(text, display, keyword_form), mt) for text, mt in t["keywords"]],
                "headlines": headlines,
                "descriptions": descriptions,
                "path1": t["path1"],
                "path2": slug,
                "url": f"{SITE}/{slug}/{TRANSACTION_PATH[key]}",
            })
    if problems:
        raise SystemExit("not sending anything:\n  " + "\n  ".join(problems))

    print("campaign: %s  [PAUSED]  budget Rs %d/day (own)  Maximise clicks, max CPC Rs %d" % (
        NEW_CAMPAIGN, BUDGET_MICROS // 1_000_000, CPC_CEILING_MICROS // 1_000_000))
    print("  search network only (no partners, no Display), presence targeting, language %s" % language_constant)
    print("  final URL suffix: %s" % final_url_suffix)
    print("  locations: %s" % ", ".join(n for n, _ in locations))
    print("  ad schedule: %d entries (copied)  negative keywords: %s  (negative brand list: not copied, see script note)" % (
        len(schedules), ", ".join(t for t, _ in negatives)))
    print("ad groups: %d" % len(plan))
    for g in plan:
        print("  [%s] %s -> %s  (%d keywords, %d headlines, %d descriptions)" % (
            g["status"], ascii_safe(g["name"]), g["url"], len(g["keywords"]), len(g["headlines"]), len(g["descriptions"])))
        print("       keywords:", ", ".join(k for k, _ in g["keywords"]))
        print("       headline 1:", g["headlines"][0], "| display path: /%s/%s" % (g["path1"], g["path2"]))
    if args.dry_run:
        return

    # --- one batch with temporary ids
    budget_service = client.get_service("CampaignBudgetService")
    campaign_service = client.get_service("CampaignService")
    ad_group_service = client.get_service("AdGroupService")
    ops = []

    budget_resource = budget_service.campaign_budget_path(CID, -1)
    op = client.get_type("MutateOperation")
    b = op.campaign_budget_operation.create
    b.resource_name = budget_resource
    b.name = "%s budget" % NEW_CAMPAIGN
    b.amount_micros = BUDGET_MICROS
    b.delivery_method = client.enums.BudgetDeliveryMethodEnum.STANDARD
    b.explicitly_shared = False
    ops.append(op)

    campaign_resource = campaign_service.campaign_path(CID, -2)
    op = client.get_type("MutateOperation")
    c = op.campaign_operation.create
    c.resource_name = campaign_resource
    c.name = NEW_CAMPAIGN
    c.status = client.enums.CampaignStatusEnum.PAUSED
    c.advertising_channel_type = client.enums.AdvertisingChannelTypeEnum.SEARCH
    c.campaign_budget = budget_resource
    c.target_spend.cpc_bid_ceiling_micros = CPC_CEILING_MICROS  # "Maximise clicks"
    c.network_settings.target_google_search = True
    c.network_settings.target_search_network = False
    c.network_settings.target_content_network = False
    c.network_settings.target_partner_search_network = False
    c.geo_target_type_setting.positive_geo_target_type = client.enums.PositiveGeoTargetTypeEnum.PRESENCE
    c.geo_target_type_setting.negative_geo_target_type = client.enums.NegativeGeoTargetTypeEnum.PRESENCE
    c.final_url_suffix = final_url_suffix
    c.contains_eu_political_advertising = client.enums.EuPoliticalAdvertisingStatusEnum.DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING
    ops.append(op)

    def campaign_criterion():
        op = client.get_type("MutateOperation")
        crit = op.campaign_criterion_operation.create
        crit.campaign = campaign_resource
        ops.append(op)
        return crit

    for _name, geo in locations:
        campaign_criterion().location.geo_target_constant = geo
    campaign_criterion().language.language_constant = language_constant
    for day, sh, sm, eh, em in schedules:
        s = campaign_criterion().ad_schedule
        s.day_of_week, s.start_hour, s.start_minute, s.end_hour, s.end_minute = day, sh, sm, eh, em
    for text, match_type in negatives:
        crit = campaign_criterion()
        crit.negative = True
        crit.keyword.text = text
        crit.keyword.match_type = match_type
    # The negative brand list is NOT copied: the API refuses it on this campaign ("brand lists can only be applied to exclusive
    # targeting, broad match campaigns ... or PMax"). Add the exclusion in the Ads UI if wanted (Metro-Seeker Intent has one).

    temp = -3
    for g in plan:
        ag_resource = ad_group_service.ad_group_path(CID, temp)
        temp -= 1
        op = client.get_type("MutateOperation")
        ag = op.ad_group_operation.create
        ag.resource_name = ag_resource
        ag.name = g["name"]
        ag.campaign = campaign_resource
        ag.status = client.enums.AdGroupStatusEnum[g["status"]]
        ag.type_ = client.enums.AdGroupTypeEnum.SEARCH_STANDARD
        ag.cpc_bid_micros = 10000  # same as the Metro-Seeker ad groups (the campaign's max CPC is the ceiling)
        ops.append(op)

        for text, match_type in g["keywords"]:
            op = client.get_type("MutateOperation")
            kw = op.ad_group_criterion_operation.create
            kw.ad_group = ag_resource
            kw.status = client.enums.AdGroupCriterionStatusEnum.ENABLED
            kw.keyword.text = text
            kw.keyword.match_type = match_type
            ops.append(op)

        op = client.get_type("MutateOperation")
        aga = op.ad_group_ad_operation.create
        aga.ad_group = ag_resource
        aga.status = client.enums.AdGroupAdStatusEnum.ENABLED
        aga.ad.final_urls.append(g["url"])
        rsa = aga.ad.responsive_search_ad
        for h in g["headlines"]:
            asset = client.get_type("AdTextAsset")
            asset.text = h
            rsa.headlines.append(asset)
        for d in g["descriptions"]:
            asset = client.get_type("AdTextAsset")
            asset.text = d
            rsa.descriptions.append(asset)
        rsa.path1 = g["path1"]
        rsa.path2 = g["path2"]
        ops.append(op)

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
        print("validated only - nothing created (%d operations)" % len(ops))
    else:
        print("created campaign '%s' (PAUSED) with %d ad groups, %d operations" % (NEW_CAMPAIGN, len(plan), len(resp.mutate_operation_responses)))


if __name__ == "__main__":
    main()
