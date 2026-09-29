import type { ListingCategory, TransactionType } from '@bhavano/types';
import { listingAttributesIssue } from '@bhavano/types/categoryFields';
import { ListingsService } from './listings.service';

// The post-ad forms block Preview on listingAttributesIssue; this keeps it rejecting exactly what
// the BFF would, so nothing it passes fails later on Post ad.
function serverIssue(
  category: ListingCategory,
  transactionType: TransactionType,
  attributes: Record<string, string | string[]>,
): string | null {
  const service = Object.create(ListingsService.prototype) as {
    assertValidAttributes: (
      c: ListingCategory,
      t: TransactionType,
      a: Record<string, unknown>,
    ) => void;
  };
  try {
    service.assertValidAttributes(category, transactionType, attributes);
    return null;
  } catch (error) {
    return (error as Error).message;
  }
}

const base = {
  bedrooms: '2',
  bathrooms: '1',
  carpetAreaSqft: '900',
  carpetAreaSqftUnit: 'sqft',
};

const cases: [
  string,
  ListingCategory,
  TransactionType,
  Record<string, string | string[]>,
][] = [
  ['valid apartment', 'apartment', 'rent', { ...base, totalFloors: '4' }],
  ['0 total floors', 'apartment', 'rent', { ...base, totalFloors: '0' }],
  ['decimal bedrooms', 'apartment', 'rent', { ...base, bedrooms: '2.5' }],
  ['missing bedrooms', 'apartment', 'rent', { ...base, bedrooms: '' }],
  ['bad floor option', 'apartment', 'rent', { ...base, floor: 'penthouse' }],
  [
    'brokerage yes without amount',
    'apartment',
    'rent',
    { ...base, fromBroker: 'yes', brokerageFeeApplicable: 'yes' },
  ],
  [
    'brokerage yes with amount',
    'apartment',
    'rent',
    {
      ...base,
      fromBroker: 'yes',
      brokerageFeeApplicable: 'yes',
      brokerageFee: '5000',
    },
  ],
];

describe('listingAttributesIssue', () => {
  it.each(cases)(
    'agrees with the BFF: %s',
    (_name, category, transactionType, attributes) => {
      const server = serverIssue(category, transactionType, attributes);
      const client = listingAttributesIssue(
        category,
        transactionType,
        attributes,
      );
      expect(client === null).toBe(server === null);
    },
  );

  it('passes a complete listing', () => {
    expect(
      listingAttributesIssue('apartment', 'rent', {
        ...base,
        totalFloors: '4',
      }),
    ).toBeNull();
    expect(
      serverIssue('apartment', 'rent', { ...base, totalFloors: '4' }),
    ).toBeNull();
  });

  it('uses the BFF wording for number fields', () => {
    expect(
      listingAttributesIssue('apartment', 'rent', {
        ...base,
        totalFloors: '0',
      }),
    ).toBe(serverIssue('apartment', 'rent', { ...base, totalFloors: '0' }));
  });
});
