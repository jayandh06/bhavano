"""Read-only: does each enabled ad group carry keywords that fit it, and what are they matching?

Three GAQL queries:
  1. ad_group_criterion -> every enabled keyword in enabled ad groups of enabled campaigns, with
     match type and quality score (including keywords with no traffic).
  2. keyword_view -> clicks / cost / conversions per keyword since SINCE_DATE.
  3. search_term_view -> the actual searches each ad group paid for since SINCE_DATE.

Writes everything to ads_keyword_audit.out.txt. Nothing here mutates.
Run: python ads_keyword_audit.py [since-date]
"""

import datetime
import sys
from collections import defaultdict

from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException

CID = "4214066478"
# The conversion goal changed on 2026-09-28 (registration made secondary) and the Other-Metro
# campaigns were narrowed the same day — see docs/plans/google-ads-performance-analysis-2026-09.md.
SINCE_DATE = sys.argv[1] if len(sys.argv) > 1 else "2026-09-28"
UNTIL_DATE = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()
OUT = "ads_keyword_audit.out.txt"


def rows(ga, query):
    try:
        return list(ga.search(customer_id=CID, query=query))
    except GoogleAdsException as e:
        print("  query failed: %s" % (e.failure.errors[0].message if e.failure.errors else e))
        return []


def enum_name(v):
    return v.name if hasattr(v, "name") else str(v)


def main():
    client = make_client()
    ga = client.get_service("GoogleAdsService")
    out = open(OUT, "w", encoding="utf-8")

    def p(s=""):
        out.write(s + "\n")

    keywords = rows(ga, """
        SELECT campaign.name, ad_group.id, ad_group.name, ad_group_criterion.criterion_id,
               ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type,
               ad_group_criterion.negative, ad_group_criterion.quality_info.quality_score
        FROM ad_group_criterion
        WHERE ad_group_criterion.type = 'KEYWORD'
          AND ad_group_criterion.status = 'ENABLED'
          AND ad_group.status = 'ENABLED'
          AND campaign.status = 'ENABLED'
    """)
    perf = rows(ga, """
        SELECT ad_group.id, ad_group_criterion.criterion_id, metrics.clicks, metrics.cost_micros,
               metrics.conversions, metrics.impressions
        FROM keyword_view
        WHERE segments.date BETWEEN '%s' AND '%s'
          AND ad_group.status = 'ENABLED' AND campaign.status = 'ENABLED'
    """ % (SINCE_DATE, UNTIL_DATE))
    terms = rows(ga, """
        SELECT campaign.name, ad_group.id, ad_group.name, search_term_view.search_term,
               search_term_view.status, metrics.clicks, metrics.cost_micros, metrics.conversions
        FROM search_term_view
        WHERE segments.date BETWEEN '%s' AND '%s'
          AND ad_group.status = 'ENABLED' AND campaign.status = 'ENABLED'
          AND metrics.clicks > 0
    """ % (SINCE_DATE, UNTIL_DATE))

    kpi = defaultdict(lambda: [0, 0.0, 0.0, 0])  # (ag, crit) -> clicks, cost, conv, impr
    for r in perf:
        k = kpi[(r.ad_group.id, r.ad_group_criterion.criterion_id)]
        k[0] += r.metrics.clicks
        k[1] += r.metrics.cost_micros / 1e6
        k[2] += r.metrics.conversions
        k[3] += r.metrics.impressions

    groups = {}
    for r in keywords:
        g = groups.setdefault(r.ad_group.id, {"campaign": r.campaign.name, "name": r.ad_group.name,
                                              "kw": [], "neg": [], "terms": []})
        crit = r.ad_group_criterion
        entry = (crit.keyword.text, enum_name(crit.keyword.match_type), crit.quality_info.quality_score,
                 kpi.get((r.ad_group.id, crit.criterion_id), [0, 0.0, 0.0, 0]))
        (g["neg"] if crit.negative else g["kw"]).append(entry)

    for r in terms:
        g = groups.get(r.ad_group.id)
        if g is None:
            continue
        g["terms"].append((r.search_term_view.search_term, r.metrics.clicks,
                           r.metrics.cost_micros / 1e6, r.metrics.conversions))

    p("Window: %s -> %s   (customer %s)" % (SINCE_DATE, UNTIL_DATE, CID))
    for agid, g in sorted(groups.items(), key=lambda kv: (kv[1]["campaign"], kv[1]["name"])):
        cost = sum(k[3][1] for k in g["kw"])
        conv = sum(k[3][2] for k in g["kw"])
        p("\n" + "=" * 100)
        p("%s  /  %s   [ad group %s]   cost=%.0f conv=%.1f CPA=%s" % (
            g["campaign"], g["name"], agid, cost, conv, "%.0f" % (cost / conv) if conv else "-"))
        p("-" * 100)
        p("  KEYWORDS (text | match | QS | impr | clicks | cost | conv)")
        for text, mt, qs, (cl, co, cv, im) in sorted(g["kw"], key=lambda e: -e[3][1]):
            p("    %-48s %-7s QS=%-2s %6d %5d %8.0f %5.1f" % (text[:48], mt[:7], qs or "-", im, cl, co, cv))
        if g["neg"]:
            p("  AD-GROUP NEGATIVES: " + ", ".join("%s(%s)" % (t, m[:5]) for t, m, _, _ in g["neg"]))
        p("  TOP SEARCH TERMS by cost (term | clicks | cost | conv)")
        for term, cl, co, cv in sorted(g["terms"], key=lambda e: -e[2])[:25]:
            p("    %-60s %4d %7.0f %5.1f" % (term[:60], cl, co, cv))
    out.close()
    print("wrote %s: %d ad groups, %d keywords, %d search-term rows"
          % (OUT, len(groups), len(keywords), len(terms)))


if __name__ == "__main__":
    main()
