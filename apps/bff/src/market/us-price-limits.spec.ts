import type { ListingCategory } from '@bhavano/types';
import {
  CATEGORY_FIELD_CONFIG,
  brokerageFeeIssue,
  brokerageFeeNote,
  categoryFieldsFor,
  defaultAttributesFor,
  formatFieldLabel,
  formatFieldValue,
  listingAttributesIssue,
  numberFieldIssue,
} from '@bhavano/types/categoryFields';
import { MARKETS } from '@bhavano/types/market';
import { postDetailsIssues, type DetailsIssueInput } from '@bhavano/types/postDetailsIssues';
import { PRICE_BOUNDS, US_PRICE_BOUNDS, listingPriceIssue, priceBoundsFor } from '@bhavano/types/priceBounds';

/** US prices, money fields and brokerage (docs/plans/us-price-limits.md), with India beside them so a US change cannot move India. */

const field = (category: ListingCategory, key: string, market?: 'in' | 'us') => {
  const found = categoryFieldsFor(category, market).find((f) => f.key === key);
  if (!found) throw new Error(`${category} has no field ${key}`);
  return found;
};

describe('US price limits', () => {
  it('has its own limits for every category the US offers', () => {
    for (const category of MARKETS.us.categories) expect(US_PRICE_BOUNDS[category]).toBeDefined();
  });

  it('leaves India on its own limits', () => {
    for (const category of MARKETS.in.categories) {
      expect(priceBoundsFor(category, 'sell')).toBe(PRICE_BOUNDS[category].sale);
      expect(priceBoundsFor(category, 'rent', 'in')).toBe(PRICE_BOUNDS[category].rental);
    }
    expect(listingPriceIssue('apartment', 'rent', 950)).toMatch(/^Price ₹950 is outside/);
  });

  it('accepts ordinary US ads that the rupee limits refused', () => {
    expect(listingPriceIssue('apartment', 'rent', 950, undefined, 'us')).toBeNull();
    expect(listingPriceIssue('storage', 'rent', 85, undefined, 'us')).toBeNull();
    expect(listingPriceIssue('commercial', 'rent', 1_800, undefined, 'us')).toBeNull();
    expect(listingPriceIssue('condo', 'sell', 85_000, undefined, 'us')).toBeNull();
    expect(listingPriceIssue('room', 'rent', 750, undefined, 'us')).toBeNull();
  });

  it('accepts the national averages the limits come from', () => {
    expect(listingPriceIssue('house', 'sell', 416_700, undefined, 'us')).toBeNull();
    expect(listingPriceIssue('apartment', 'rent', 2_000, undefined, 'us')).toBeNull();
    expect(listingPriceIssue('room', 'rent', 1_000, undefined, 'us')).toBeNull();
    expect(listingPriceIssue('storage', 'rent', 119, undefined, 'us')).toBeNull();
    expect(listingPriceIssue('commercial', 'sell', 575_000, undefined, 'us')).toBeNull();
  });

  it('accepts both ends of a range and refuses one past them, in dollars', () => {
    for (const price of [40_000, 20_000_000]) expect(listingPriceIssue('house', 'sell', price, undefined, 'us')).toBeNull();
    for (const price of [39_999, 20_000_001]) expect(listingPriceIssue('house', 'sell', price, undefined, 'us')).not.toBeNull();
    expect(listingPriceIssue('apartment', 'lease', 20, undefined, 'us')).toBe(
      'Price $20 is outside the expected range ($200 to $100,000) for this category',
    );
  });

  it('shows the per-unit working in dollars', () => {
    expect(listingPriceIssue('house', 'sell', 90_000 * 2_000, { price: 90_000, area: 2_000, unit: 'sqft' }, 'us')).toBe(
      '$90,000/sq ft × 2,000 sq ft comes to $180,000,000, outside the expected range ($40,000 to $20,000,000) for this category. ' +
        'Check the price per sq ft and the area.',
    );
  });
});

describe('money fields', () => {
  it('hands India the shared config itself', () => {
    for (const category of Object.keys(CATEGORY_FIELD_CONFIG) as ListingCategory[]) {
      expect(categoryFieldsFor(category)).toBe(CATEGORY_FIELD_CONFIG[category]);
      expect(categoryFieldsFor(category, 'in')).toBe(CATEGORY_FIELD_CONFIG[category]);
    }
  });

  it('shows no rupee sign on any US field', () => {
    for (const category of MARKETS.us.categories) {
      const labels = categoryFieldsFor(category, 'us').map((f) => f.label);
      expect(labels.filter((label) => label.includes('₹'))).toEqual([]);
    }
  });

  it('labels and prints amounts in dollars in the US and rupees in India', () => {
    expect(field('apartment', 'securityDeposit', 'us').label).toBe('Security deposit ($)');
    expect(field('apartment', 'securityDeposit', 'in').label).toBe('Security deposit (₹)');
    expect(formatFieldLabel(field('apartment', 'securityDeposit', 'us'))).toBe('Security deposit');
    expect(formatFieldValue(field('apartment', 'securityDeposit', 'us'), 150_000, 'us')).toBe('$150,000');
    expect(formatFieldValue(field('apartment', 'securityDeposit'), 150_000)).toBe('₹1,50,000');
  });

  it('keeps the rupee minimum on a brokerage fee in India only', () => {
    expect(numberFieldIssue(field('apartment', 'brokerageFee', 'us'), 100)).toBeNull();
    expect(numberFieldIssue(field('apartment', 'brokerageFee', 'us'), 0)).toContain('Brokerage Fee ($)');
    expect(numberFieldIssue(field('apartment', 'brokerageFee'), 100)).toContain('at least 500');
  });
});

describe('brokerage', () => {
  const fixed = { brokerageFeeApplicable: 'yes', brokerageFeeType: 'fixed', brokerageFee: '500' };

  it('lets a small fixed fee through on a US sale and not on an Indian one', () => {
    expect(brokerageFeeIssue('sell', 400_000, fixed, 'us')).toBeNull();
    expect(brokerageFeeIssue('sell', 400_000, fixed)).toBe('Brokerage Fee (₹) must be at least ₹1,000 on a sale');
  });

  it('keeps the ceilings, worded in dollars', () => {
    expect(brokerageFeeIssue('sell', 400_000, { ...fixed, brokerageFee: '20001' }, 'us')).toBe(
      'Brokerage Fee ($) can be at most $20,000 (5% of the price)',
    );
    expect(brokerageFeeIssue('rent', 2_000, { ...fixed, brokerageFee: '4001' }, 'us')).toBe(
      "Brokerage Fee ($) can be at most $4,000 (2 months' rent)",
    );
    expect(brokerageFeeNote('rent', 2_000, fixed, 'us')?.text).toBe("Up to $4,000 (2 months' rent)");
    expect(brokerageFeeNote('sell', 400_000, { brokerageFeeApplicable: 'yes', brokerageFeeType: 'percent', brokerageCommissionPercent: '2' }, 'us')?.text).toBe(
      '≈ $8,000 of $400,000',
    );
  });
});

describe('the post form on the US', () => {
  const input = (category: ListingCategory, marketId?: 'in' | 'us'): DetailsIssueInput => ({
    hasPin: true,
    pinLookingUp: false,
    hasCity: true,
    areaText: 'Downtown',
    areaIsExisting: true,
    areaMaxLength: 80,
    needsPostedBy: false,
    postedByAnswered: true,
    category,
    transactionType: 'rent',
    attributes: defaultAttributesFor(category),
    priceMissing: false,
    priceIssue: null,
    totalPrice: 2_000,
    photoCount: 3,
    minPhotos: 3,
    askSellerType: false,
    sellerTypeAnswered: true,
    assistedProblem: null,
    title: 'A bright two bed apartment downtown',
    titleMin: 10,
    description: 'x'.repeat(80),
    descriptionMin: 50,
    marketId,
  });

  it('never asks for a field the US does not show', () => {
    for (const category of MARKETS.us.categories) {
      const targets = postDetailsIssues(input(category, 'us')).map((issue) => issue.target);
      for (const key of MARKETS.us.hiddenFieldKeys) expect(targets).not.toContain(`attr:${key}`);
    }
  });

  it('still asks India for entrance facing', () => {
    expect(postDetailsIssues(input('apartment')).map((issue) => issue.target)).toContain('attr:entranceFacing');
  });

  it('names a missing money field in dollars', () => {
    const issue = listingAttributesIssue('apartment', 'rent', { maintenanceFeeApplicable: 'yes', bedrooms: '2' }, 2_000, 'us');
    expect(issue ?? '').not.toContain('₹');
  });
});
