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
  floor: '2',
  totalFloors: '4',
  entranceFacing: 'east',
};

const broker = { ...base, fromBroker: 'yes', brokerageFeeApplicable: 'yes' };

const cases: [
  string,
  ListingCategory,
  TransactionType,
  Record<string, string | string[]>,
][] = [
  ['valid apartment', 'apartment', 'rent', base],
  ['0 total floors', 'apartment', 'rent', { ...base, totalFloors: '0' }],
  ['missing total floors', 'apartment', 'rent', { ...base, totalFloors: '' }],
  ['missing floor', 'apartment', 'rent', { ...base, floor: '' }],
  [
    'missing entrance facing',
    'apartment',
    'rent',
    { ...base, entranceFacing: '' },
  ],
  ['decimal bedrooms', 'apartment', 'rent', { ...base, bedrooms: '2.5' }],
  ['missing bedrooms', 'apartment', 'rent', { ...base, bedrooms: '' }],
  ['bad floor option', 'apartment', 'rent', { ...base, floor: 'penthouse' }],
  ['rent brokerage without amount', 'apartment', 'rent', broker],
  [
    'rent brokerage with amount',
    'apartment',
    'rent',
    { ...broker, brokerageFee: '5000' },
  ],
  [
    'rent brokerage under ₹500',
    'apartment',
    'rent',
    { ...broker, brokerageFee: '400' },
  ],
  ['sale brokerage without type', 'apartment', 'sell', broker],
  [
    'fixed brokerage without amount',
    'apartment',
    'sell',
    { ...broker, brokerageFeeType: 'fixed' },
  ],
  [
    'fixed brokerage with amount',
    'apartment',
    'sell',
    { ...broker, brokerageFeeType: 'fixed', brokerageFee: '5000' },
  ],
  [
    'fixed brokerage with decimals',
    'apartment',
    'sell',
    { ...broker, brokerageFeeType: 'fixed', brokerageFee: '5000.5' },
  ],
  [
    'percent brokerage on a rental',
    'apartment',
    'rent',
    {
      ...broker,
      brokerageFeeType: 'percent',
      brokerageCommissionPercent: '8.33',
    },
  ],
  [
    'percent brokerage with 3 decimals',
    'apartment',
    'sell',
    {
      ...broker,
      brokerageFeeType: 'percent',
      brokerageCommissionPercent: '1.125',
    },
  ],
  [
    'percent brokerage over 5',
    'commercial',
    'sell',
    {
      fromBroker: 'yes',
      brokerageFeeApplicable: 'yes',
      brokerageFeeType: 'percent',
      brokerageCommissionPercent: '6',
    },
  ],
  [
    'percent brokerage under 0.25',
    'apartment',
    'sell',
    { ...broker, brokerageFeeType: 'percent', brokerageCommissionPercent: '0.2' },
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
    expect(listingAttributesIssue('apartment', 'rent', base)).toBeNull();
    expect(serverIssue('apartment', 'rent', base)).toBeNull();
  });

  it('uses the BFF wording for number fields', () => {
    const zeroFloors = { ...base, totalFloors: '0' };
    expect(listingAttributesIssue('apartment', 'rent', zeroFloors)).toBe(
      serverIssue('apartment', 'rent', zeroFloors),
    );
    const percent = {
      ...broker,
      brokerageFeeType: 'percent',
      brokerageCommissionPercent: '150',
    };
    expect(listingAttributesIssue('apartment', 'sell', percent)).toBe(
      'Brokerage Fee (%) must be between 0.25 and 5, up to 2 decimal places',
    );
    expect(serverIssue('apartment', 'sell', percent)).toBe(
      listingAttributesIssue('apartment', 'sell', percent),
    );
  });

  it('accepts both brokerage types on a sale', () => {
    expect(
      listingAttributesIssue('apartment', 'sell', {
        ...broker,
        brokerageFeeType: 'fixed',
        brokerageFee: '200000',
      }),
    ).toBeNull();
    expect(
      listingAttributesIssue('apartment', 'sell', {
        ...broker,
        brokerageFeeType: 'percent',
        brokerageCommissionPercent: '1.5',
      }),
    ).toBeNull();
  });

  it('holds the ₹ amount to the price when one is given', () => {
    const rent = { ...base, fromBroker: 'yes', brokerageFeeApplicable: 'yes', brokerageFee: '50000' };
    expect(listingAttributesIssue('apartment', 'rent', rent)).toBeNull();
    expect(listingAttributesIssue('apartment', 'rent', rent, 25_000)).toBeNull();
    expect(listingAttributesIssue('apartment', 'rent', rent, 20_000)).toBe(
      "Brokerage Fee (₹) can be at most ₹40,000 (2 months' rent)",
    );
  });
});
