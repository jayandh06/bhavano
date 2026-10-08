"""Keyword cleanup + additions following the account's own proven QS pattern (short, 3-4 word,
one owner-verb + object + channel-qualifier — e.g. "sell flat online", QS 8) rather than more
long-tail phrasing, which the Oct-5 audit's own additions show mostly never accumulate enough
volume to be scored at all.

1. PAUSE 3 keyword criteria — real spend, real underperformance, not a volume problem:
   - "rent furniture" (Metro + Other-Metro Rent Out 2.5/Furniture): QS5, ₹134 spend/30d, 0 conv.
     Reads as a tenant wanting to rent furniture, not an owner renting it out — same wrong-side-
     of-marketplace pattern as "coliving pg" from the Oct 5 audit.
   - "rent your property" (Other-Metro Rent Out 2.4/Commercial): QS6, ₹438 spend/30d, 1 conv
     (CPA ₹438, 3-4x the account's working average).

2. PAUSE 3 ad groups — Metro-Seeker Intent's Bengaluru/Pune/Kolkata "Buy Seekers": confirmed
   structurally blocked (big portals outbid this account on buy-intent terms), 0 impressions
   each over 30 days, and the campaign's own budget was just cut to a token ₹100/day. Pausing
   removes dead clutter, loses nothing that was actually being won.

3. ADD 10 new keywords (PHRASE match) in the account's own proven shape, in ad groups that
   don't yet have a short-form variant — explicitly checked against each ad group's existing
   keyword list first to avoid exact or near-exact duplicates ("list pg online" and "lease
   office space" were dropped from the original proposal for exactly this reason). Rent Out
   Villa/Independent House was dropped entirely: already tried broadening there (sell villa
   online, rent out villa online) with zero traffic either way — a demand problem, not a
   wording one, so piling on more there would repeat something already shown not to work.

Run: python ads_keyword_cleanup_2026_10_08.py --dry-run     read-only, prints the plan
     python ads_keyword_cleanup_2026_10_08.py --validate    Google validates, nothing created
     python ads_keyword_cleanup_2026_10_08.py                applies
"""

import argparse

from ads_setup_conversions import make_client
from google.ads.googleads.errors import GoogleAdsException

CID = '4214066478'

PAUSE_KEYWORDS = [
    ('customers/4214066478/adGroupCriteria/201629875084~124963392', 'Metro Rent Out 2.5 / "rent furniture"'),
    ('customers/4214066478/adGroupCriteria/198875640605~124963392', 'Other-Metro Rent Out 2.5 / "rent furniture"'),
    ('customers/4214066478/adGroupCriteria/198875640645~149405589', 'Other-Metro Rent Out 2.4 / "rent your property"'),
]

PAUSE_AD_GROUPS = [
    ('customers/4214066478/adGroups/199354221734', 'Metro-Seeker Intent / Bengaluru Buy Seekers'),
    ('customers/4214066478/adGroups/199354221814', 'Metro-Seeker Intent / Pune Buy Seekers'),
    ('customers/4214066478/adGroups/202226465922', 'Metro-Seeker Intent / Kolkata Buy Seekers'),
]

# ad_group resource name -> list of new keyword texts (PHRASE match)
NEW_KEYWORDS = {
    'customers/4214066478/adGroups/202586212471': ['lease flat online', 'lease property online'],  # Metro Lease 3.2
    'customers/4214066478/adGroups/203420143191': ['lease flat online', 'lease property online'],  # Other-Metro Lease 3.2
    'customers/4214066478/adGroups/201054972659': ['lease flat online', 'lease property online'],  # Other-Metro-MaxConv Lease 3.2
    'customers/4214066478/adGroups/201241143962': ['post pg for rent'],                              # Metro Rent Out 2.2
    'customers/4214066478/adGroups/198875640685': ['post pg for rent'],                              # Other-Metro Rent Out 2.2
    'customers/4214066478/adGroups/199363402229': ['rent commercial property online'],               # Metro Rent Out 2.4
    'customers/4214066478/adGroups/198875640645': ['rent commercial property online'],               # Other-Metro Rent Out 2.4
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
    print('Pause keywords:')
    for rn, label in PAUSE_KEYWORDS:
        print('  %s' % label)
    print()
    print('Pause ad groups:')
    for rn, label in PAUSE_AD_GROUPS:
        print('  %s' % label)
    print()
    print('Add keywords:')
    total_new = 0
    for ad_group_rn, texts in NEW_KEYWORDS.items():
        for t in texts:
            print('  %-50s + "%s" (PHRASE)' % (ad_group_rn.split('/')[-1], t))
            total_new += 1

    if args.dry_run:
        print('\n[dry run] %d operation(s) planned, nothing sent.' % (len(PAUSE_KEYWORDS) + len(PAUSE_AD_GROUPS) + total_new))
        return

    ops = []
    for rn, _label in PAUSE_KEYWORDS:
        op = client.get_type('MutateOperation')
        op.ad_group_criterion_operation.update.resource_name = rn
        op.ad_group_criterion_operation.update.status = client.enums.AdGroupCriterionStatusEnum.PAUSED
        op.ad_group_criterion_operation.update_mask.paths.append('status')
        ops.append(op)

    for rn, _label in PAUSE_AD_GROUPS:
        op = client.get_type('MutateOperation')
        op.ad_group_operation.update.resource_name = rn
        op.ad_group_operation.update.status = client.enums.AdGroupStatusEnum.PAUSED
        op.ad_group_operation.update_mask.paths.append('status')
        ops.append(op)

    for ad_group_rn, texts in NEW_KEYWORDS.items():
        for t in texts:
            op = client.get_type('MutateOperation')
            op.ad_group_criterion_operation.create.ad_group = ad_group_rn
            op.ad_group_criterion_operation.create.status = client.enums.AdGroupCriterionStatusEnum.ENABLED
            op.ad_group_criterion_operation.create.keyword.text = t
            op.ad_group_criterion_operation.create.keyword.match_type = client.enums.KeywordMatchTypeEnum.PHRASE
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
