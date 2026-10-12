"""Pauses (never removes) enabled keywords with zero impressions in the last 11 days
(2026-09-28 -> 2026-10-08), across all enabled ad groups/campaigns.

Excluded on purpose, not stale data:
  - All PG owner keywords added 2026-10-05 (list my pg, post pg ad, get tenants for my pg,
    pg owner app, post pg for rent, advertise pg for free) in both Metro and Other-Metro Rent
    Out 2.2 - they need their agreed data window before any verdict.
  - The Lease 3.1 Commercial owner keywords added the same day (lease my office space,
    list office space for lease, Lease my shop) in both Metro and Other-Metro Lease 3.1.
  - Every keyword in Lease 3.2 Residential (both campaigns) - review explicitly deferred to
    2026-10-12 in docs/plans/google-ads-keyword-audit-2026-10.md; not this script's call.

Everything else zero-impression, including the 3 already-fully-dormant Villa ad groups
(Metro/Other-Metro Rent Out 2.3, Other-Metro Sell 1.3), is paused as-is - no replacement
keywords added. 90 days of account-wide search-term history show zero owner-intent villa
queries ever occurred (every villa/bungalow/independent-house search term is seeker-side),
so there's no niche villa wording to try; left dormant by explicit choice, not fixed.

Pause, never remove - reversible and keeps history, same rule as ads_apply_keyword_audit.py.

Run: python ads_pause_zero_impression.py --dry-run   (validate_only: Google checks, nothing changes)
     python ads_pause_zero_impression.py
"""

import sys
from collections import defaultdict

from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException
from google.api_core import protobuf_helpers

CID = "4214066478"
DRY = "--dry-run" in sys.argv
SINCE, UNTIL = "2026-09-28", "2026-10-08"

# (campaign name, ad group name) -> keyword texts to leave alone even if zero-impression.
EXCLUDE = {
    ("Metro-Rent Out Property (Owners)", "Ad Group 2.2 — Rent Out PG"): {
        "get tenants for my pg", "advertise pg for free", "post pg for rent",
    },
    ("Other-Metro-Rent Out Property (Owners)", "Ad Group 2.2 — Rent Out PG"): {
        "list my pg", "post pg ad", "get tenants for my pg", "pg owner app",
        "post pg for rent", "advertise pg for free",
    },
    ("Metro-Lease Property", "Ad Group 3.1 — Lease Commercial/Office"): {
        "lease my office space", "list office space for lease",
    },
    ("Other-Metro-Lease Property-MaxConv", "Ad Group 3.1 — Lease Commercial/Office"): {
        "lease my office space", "Lease my shop",
    },
    # Entire ad group deferred to the 2026-10-12 review - not this script's call.
    ("Metro-Lease Property", "Ad Group 3.2 — Lease Residential/Long-term"): None,
    ("Other-Metro-Lease Property-MaxConv", "Ad Group 3.2 — Lease Residential/Long-term"): None,
}


def main():
    client = make_client()
    ga = client.get_service("GoogleAdsService")
    ag_service = client.get_service("AdGroupCriterionService")

    keywords = list(ga.search(customer_id=CID, query="""
        SELECT campaign.name, ad_group.id, ad_group.name, ad_group_criterion.criterion_id,
               ad_group_criterion.keyword.text, ad_group_criterion.resource_name
        FROM ad_group_criterion
        WHERE ad_group_criterion.type = 'KEYWORD' AND ad_group_criterion.negative = FALSE
          AND ad_group_criterion.status = 'ENABLED' AND ad_group.status = 'ENABLED'
          AND campaign.status = 'ENABLED'
    """))
    perf = list(ga.search(customer_id=CID, query="""
        SELECT ad_group.id, ad_group_criterion.criterion_id, metrics.impressions
        FROM keyword_view
        WHERE segments.date BETWEEN '%s' AND '%s'
          AND ad_group.status = 'ENABLED' AND campaign.status = 'ENABLED'
    """ % (SINCE, UNTIL)))

    impr = defaultdict(int)
    for r in perf:
        impr[(r.ad_group.id, r.ad_group_criterion.criterion_id)] += r.metrics.impressions

    to_pause = []
    for k in keywords:
        key = (k.ad_group.id, k.ad_group_criterion.criterion_id)
        if impr.get(key, 0) != 0:
            continue
        excl = EXCLUDE.get((k.campaign.name, k.ad_group.name), set())
        if excl is None or k.ad_group_criterion.keyword.text in excl:
            continue
        to_pause.append(k)

    print("%s: pausing %d zero-impression keywords" % ("[DRY RUN] " if DRY else "", len(to_pause)))
    by_group = defaultdict(list)
    for k in to_pause:
        by_group[(k.campaign.name, k.ad_group.name)].append(k.ad_group_criterion.keyword.text)
    for (camp, ag), kws in sorted(by_group.items()):
        print("  %s / %s (%d)" % (camp, ag, len(kws)))
        for t in kws:
            print("    - %s" % t)

    if not to_pause:
        return

    operations = []
    for k in to_pause:
        op = client.get_type("AdGroupCriterionOperation")
        crit = op.update
        crit.resource_name = k.ad_group_criterion.resource_name
        crit.status = client.enums.AdGroupCriterionStatusEnum.PAUSED
        client.copy_from(op.update_mask, protobuf_helpers.field_mask(None, crit._pb))
        operations.append(op)

    try:
        resp = ag_service.mutate_ad_group_criteria(
            request={"customer_id": CID, "operations": operations, "validate_only": DRY}
        )
        if DRY:
            print("\n[DRY RUN] Google validated %d pause operations - no live change made." % len(operations))
        else:
            print("\nPaused %d keywords." % len(resp.results))
    except GoogleAdsException as e:
        print("FAILED:")
        for err in e.failure.errors:
            print("  -", err.message)


if __name__ == "__main__":
    main()
