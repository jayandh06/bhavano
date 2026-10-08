"""Reallocates daily campaign budgets to a ₹5,000/day combined total (down from today's ₹5,150)
and raises the shared Bhavano-TargetCPA portfolio's target from ₹115 to ₹135.

Why: 30-day performance (2026-09-08 -> 2026-10-07) showed actual combined spend (~₹2,939/day avg)
running well under the ₹5,150/day budget cap, while several of the strongest campaigns (Metro-Sell
₹119 CPA, Metro-Rent Out ₹128 CPA) were already running above the ₹115 target — meaning the target
wasn't actually the thing letting them spend more, demand at that price was. Raising it to ₹135
(near the median of the strong campaigns) and shifting budget away from the two campaigns that
aren't working (Metro-Seeker Intent: ₹1,312 CPA on 2 conversions in 30 days; Other-Metro-Generic:
₹209 CPA, the weakest Other-Metro campaign) toward the proven poster campaigns is the actual lever
— a budget number alone doesn't change delivery while the target is still underneath it.

Two separate mutations, both idempotent (re-running after a partial apply just re-sets the same
target values, a no-op for whatever already matches):
  1. 9 campaign_budget.amount_micros updates.
  2. 1 bidding_strategy.target_cpa.target_cpa_micros update (Bhavano-TargetCPA: ₹115 -> ₹135).
     cpc_bid_ceiling_micros (₹75, untouched elsewhere) is deliberately left alone — not in scope.

Run: python ads_budget_realloc_2026_10_08.py --dry-run     read-only, prints the plan
     python ads_budget_realloc_2026_10_08.py --validate    Google validates, nothing is created
     python ads_budget_realloc_2026_10_08.py                applies
"""

import argparse

from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException

CID = '4214066478'

# campaign name -> (campaign_budget resource name, new daily budget in rupees)
NEW_BUDGETS = {
    'Metro-Sell Property (Owners/Agents)': ('customers/4214066478/campaignBudgets/15844996057', 1100),
    'Metro-Rent Out Property (Owners)': ('customers/4214066478/campaignBudgets/15834711278', 1000),
    'Metro-Generic Post Ad Intent': ('customers/4214066478/campaignBudgets/15844997968', 1000),
    'Metro-Lease Property': ('customers/4214066478/campaignBudgets/15844993126', 700),
    'Other-Metro-Sell Property (Owners/Agents)': ('customers/4214066478/campaignBudgets/15897735836', 350),
    'Other-Metro-Rent Out Property (Owners)': ('customers/4214066478/campaignBudgets/15907926199', 250),
    'Other-Metro-Generic Post Ad Intent': ('customers/4214066478/campaignBudgets/15907994548', 150),
    'Metro-Seeker Intent': ('customers/4214066478/campaignBudgets/15906321326', 100),
    'Other-Metro-Lease Property-MaxConv': ('customers/4214066478/campaignBudgets/15928766052', 350),
}
NEW_TOTAL = sum(rupees for _, rupees in NEW_BUDGETS.values())
assert NEW_TOTAL == 5000, f'Expected 5000, got {NEW_TOTAL} — check NEW_BUDGETS before running'

TARGET_CPA_STRATEGY = 'customers/4214066478/biddingStrategies/12257987260'  # Bhavano-TargetCPA
NEW_TARGET_CPA_RUPEES = 135


def rows(ga, query):
    try:
        return list(ga.search(customer_id=CID, query=query))
    except GoogleAdsException as e:
        print('  query failed: %s' % (e.failure.errors[0].message if e.failure.errors else e))
        return []


def fail(label, e):
    for err in e.failure.errors:
        print('%s FAILED: %s' % (label, err.message))
    raise SystemExit(1)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--validate', action='store_true')
    args = parser.parse_args()

    client = make_client()
    ga = client.get_service('GoogleAdsService')

    current_budgets = rows(ga, '''
        SELECT campaign.name, campaign_budget.resource_name, campaign_budget.amount_micros
        FROM campaign WHERE campaign.status = "ENABLED"
    ''')
    current_by_name = {r.campaign.name: r.campaign_budget.amount_micros / 1e6 for r in current_budgets}

    current_strategy = rows(ga, '''
        SELECT bidding_strategy.target_cpa.target_cpa_micros,
               bidding_strategy.target_cpa.cpc_bid_ceiling_micros
        FROM bidding_strategy WHERE bidding_strategy.resource_name = "%s"
    ''' % TARGET_CPA_STRATEGY)[0].bidding_strategy

    print('Account %s   [%s]' % (CID, 'DRY RUN' if args.dry_run else 'VALIDATE' if args.validate else 'APPLY'))
    print()
    print('Budgets (today -> proposed):')
    old_total = 0.0
    for name, (_, new_rupees) in NEW_BUDGETS.items():
        old_rupees = current_by_name.get(name)
        if old_rupees is None:
            raise SystemExit('Campaign not found or not enabled: %s' % name)
        old_total += old_rupees
        marker = '' if old_rupees == new_rupees else '  <-- changing'
        print('  %-45s ₹%-6.0f -> ₹%-6.0f%s' % (name, old_rupees, new_rupees, marker))
    print('  %-45s ₹%-6.0f -> ₹%-6.0f' % ('TOTAL', old_total, NEW_TOTAL))
    print()
    print('Bhavano-TargetCPA: target_cpa ₹%.0f -> ₹%.0f (ceiling ₹%.0f, unchanged)'
          % (current_strategy.target_cpa.target_cpa_micros / 1e6, NEW_TARGET_CPA_RUPEES,
             current_strategy.target_cpa.cpc_bid_ceiling_micros / 1e6))

    if args.dry_run:
        print('\n[dry run] %d operations planned, nothing sent.' % (len(NEW_BUDGETS) + 1))
        return

    ops = []
    for name, (budget_resource_name, new_rupees) in NEW_BUDGETS.items():
        if current_by_name[name] == new_rupees:
            continue  # idempotent: already at the target value
        op = client.get_type('MutateOperation')
        op.campaign_budget_operation.update.resource_name = budget_resource_name
        op.campaign_budget_operation.update.amount_micros = new_rupees * 1_000_000
        op.campaign_budget_operation.update_mask.paths.append('amount_micros')
        ops.append(op)

    if current_strategy.target_cpa.target_cpa_micros != NEW_TARGET_CPA_RUPEES * 1_000_000:
        op = client.get_type('MutateOperation')
        op.bidding_strategy_operation.update.resource_name = TARGET_CPA_STRATEGY
        op.bidding_strategy_operation.update.target_cpa.target_cpa_micros = NEW_TARGET_CPA_RUPEES * 1_000_000
        op.bidding_strategy_operation.update_mask.paths.append('target_cpa.target_cpa_micros')
        ops.append(op)

    if not ops:
        print('\nok     everything already matches the proposed values. Nothing to do.')
        return

    req = client.get_type('MutateGoogleAdsRequest')
    req.customer_id = CID
    req.mutate_operations.extend(ops)
    req.validate_only = args.validate
    try:
        res = ga.mutate(request=req)
    except GoogleAdsException as e:
        fail('Mutate', e)
        return

    if args.validate:
        print('\n[validate] %d operations validated OK, nothing was created.' % len(ops))
        return
    print('\n%d operations applied.' % len(res.mutate_operation_responses))


if __name__ == '__main__':
    main()
