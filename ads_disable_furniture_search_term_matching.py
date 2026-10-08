"""Disables AI Max Search Term Matching on the two "Ad Group 2.5 - Rent out Furniture" ad groups
(Metro and Other-Metro), the only 2 of 35 poster ad groups where it was still enabled — every
other poster ad group across every campaign already has it disabled. Campaign-level AI Max
(`enable_ai_max`) stays on everywhere, untouched; this only flips the ad-group-level
`disable_search_term_matching` flag, matching the rest of the account's deliberately tight,
keyword-controlled targeting instead of the broad-match/asset/landing-page-based reach expansion
Search Term Matching otherwise adds.

Run: python ads_disable_furniture_search_term_matching.py --dry-run     read-only, prints the plan
     python ads_disable_furniture_search_term_matching.py --validate    Google validates, nothing created
     python ads_disable_furniture_search_term_matching.py                applies
"""

import argparse

from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException

CID = '4214066478'

AD_GROUPS = {
    'Metro-Rent Out Property (Owners) / Ad Group 2.5 - Rent out Furniture': 'customers/4214066478/adGroups/201629875084',
    'Other-Metro-Rent Out Property (Owners) / Ad Group 2.5 - Rent out Furniture': 'customers/4214066478/adGroups/198875640605',
}


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

    print('Account %s   [%s]' % (CID, 'DRY RUN' if args.dry_run else 'VALIDATE' if args.validate else 'APPLY'))
    print()

    to_change = []
    for label, resource_name in AD_GROUPS.items():
        current = rows(ga, 'SELECT ad_group.ai_max_ad_group_setting.disable_search_term_matching '
                           'FROM ad_group WHERE ad_group.resource_name = "%s"' % resource_name)[0].ad_group
        disabled = current.ai_max_ad_group_setting.disable_search_term_matching
        marker = '' if disabled else '  <-- changing'
        print('  %-70s disable_search_term_matching=%s%s' % (label, disabled, marker))
        if not disabled:
            to_change.append(resource_name)

    if args.dry_run:
        print('\n[dry run] %d operation(s) planned, nothing sent.' % len(to_change))
        return

    if not to_change:
        print('\nok     both ad groups already have it disabled. Nothing to do.')
        return

    ops = []
    for resource_name in to_change:
        op = client.get_type('MutateOperation')
        op.ad_group_operation.update.resource_name = resource_name
        op.ad_group_operation.update.ai_max_ad_group_setting.disable_search_term_matching = True
        op.ad_group_operation.update_mask.paths.append('ai_max_ad_group_setting.disable_search_term_matching')
        ops.append(op)

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
        print('\n[validate] %d operation(s) validated OK, nothing was created.' % len(ops))
        return
    print('\n%d operation(s) applied.' % len(res.mutate_operation_responses))


if __name__ == '__main__':
    main()
