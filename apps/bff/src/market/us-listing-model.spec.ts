import type { ListingCategory } from '@bhavano/types';
import { categoryFieldsFor, fieldIsVisible, listingAttributeIssues, defaultAttributesFor } from '@bhavano/types/categoryFields';
import { MARKETS } from '@bhavano/types/market';
import {
  POSTABLE_TRANSACTION_TYPES,
  allowsPerUnitPrice,
  marketDealIssue,
  marketTransactionType,
  postableTransactionTypes,
} from '@bhavano/types/postingRules';
import { marketPostCategoryGroups } from '@bhavano/types/postCategories';
import { getPriceQualifierOptions } from '@bhavano/types/priceQualifiers';
import {
  INTENT_TRANSACTION_CHOICES,
  applyIntent,
  budgetPresetsFor,
  intentCategories,
  isValidRequirementTransaction,
  requirementIntentsFor,
  transactionChoicesFor,
} from '@bhavano/types/requirementQuestions';

/** What the US lists and how (docs/plans/us-listing-model.md, phase 1), with India beside it so a US change cannot move India. */

const CATEGORIES = Object.keys(POSTABLE_TRANSACTION_TYPES) as ListingCategory[];

describe('deal types', () => {
  it('leaves India exactly as it was', () => {
    for (const category of CATEGORIES) {
      expect(postableTransactionTypes(category)).toBe(POSTABLE_TRANSACTION_TYPES[category]);
      expect(postableTransactionTypes(category, 'in')).toBe(POSTABLE_TRANSACTION_TYPES[category]);
      for (const tx of ['sell', 'rent', 'lease'] as const) expect(marketDealIssue(category, tx)).toBeNull();
    }
    expect(MARKETS.in.categories).toContain('villa');
    expect(getPriceQualifierOptions('house', 'lease').map((o) => o.value)).toEqual(['for lease term', '/month']);
    expect(allowsPerUnitPrice('lease')).toBe(true);
    expect(transactionChoicesFor('rentLease')).toBe(INTENT_TRANSACTION_CHOICES.rentLease);
  });

  it('offers the US its own', () => {
    const offered = Object.fromEntries(MARKETS.us.categories.map((c) => [c, postableTransactionTypes(c, 'us')]));
    expect(offered).toEqual({
      house: ['sell', 'rent'],
      apartment: ['rent'],
      condo: ['sell', 'rent'],
      townhouse: ['sell', 'rent'],
      storage: ['rent'],
      commercial: ['sell', 'lease'],
      room: ['rent'],
      multifamily: ['sell'],
      plot: ['sell'],
    });
  });

  it('says why a US pair is refused', () => {
    expect(marketDealIssue('apartment', 'sell', 'us')).toBe('Apartments can only be rented. To sell a unit, list it as a Condo / Co-op.');
    expect(marketDealIssue('house', 'lease', 'us')).toBe('This property is listed for rent, not for lease.');
    expect(marketDealIssue('commercial', 'rent', 'us')).toBe('Commercial space is listed for lease, not for rent.');
    expect(marketDealIssue('condo', 'sell', 'us')).toBeNull();
  });

  it('quotes a US commercial lease by the month, never per unit of area', () => {
    expect(getPriceQualifierOptions('commercial', 'lease', 'us').map((o) => o.value)).toEqual(['/month']);
    expect(allowsPerUnitPrice('lease', 'us')).toBe(false);
    expect(allowsPerUnitPrice('sell', 'us')).toBe(true);
    expect(budgetPresetsFor('commercial', 'lease', 'us').unit).toBe('per month');
  });
});

describe('villa', () => {
  it('is no longer offered in the US', () => {
    expect(MARKETS.us.categories).not.toContain('villa');
    expect(marketPostCategoryGroups('us').flatMap((g) => g.options.map((o) => o.value))).not.toContain('villa');
    for (const intent of ['buy', 'rentLease'] as const) expect(intentCategories(intent, 'us')).not.toContain('villa');
  });
});

describe('US requirements', () => {
  it('never ask "rent or lease": the category decides', () => {
    expect(transactionChoicesFor('rentLease', 'us')).toBeUndefined();
    expect(requirementIntentsFor('us').map((i) => i.label)).toEqual(['Buy', 'Rent']);
    expect(marketTransactionType('commercial', 'rent', 'us')).toBe('lease');
    expect(marketTransactionType('house', 'lease', 'us')).toBe('rent');
    expect(marketTransactionType('apartment', 'sell', 'us')).toBe('sell');
    expect(applyIntent('rentLease', { category: 'commercial', transactionType: 'sell' }, 'us')).toEqual({
      category: 'commercial',
      transactionType: 'lease',
    });
    expect(applyIntent('buy', { category: 'apartment', transactionType: 'rent' }, 'us')).toEqual({ category: undefined, transactionType: 'sell' });
  });

  it('refuse what cannot be posted', () => {
    expect(isValidRequirementTransaction('apartment', 'buy', 'us')).toBe(false);
    expect(isValidRequirementTransaction('apartment', 'buy')).toBe(true);
    expect(isValidRequirementTransaction('commercial', 'lease', 'us')).toBe(true);
  });
});

describe('US forms', () => {
  const GONE = ['reraRegistered', 'waterSource', 'gasPipeline', 'ownership', 'loanAvailable', 'possessionStatus', 'balconyCount', 'brokerageFeeApplicable', 'fireNoc'];

  it('ask none of the India-only questions, and India still does', () => {
    const seen = new Set<string>();
    for (const category of MARKETS.us.categories) {
      for (const tx of postableTransactionTypes(category, 'us')) {
        for (const field of categoryFieldsFor(category, 'us')) {
          if (fieldIsVisible(field, tx, { fromBroker: 'yes' }, 'us')) expect(GONE).not.toContain(field.key);
        }
      }
    }
    for (const category of ['apartment', 'commercial'] as const)
      for (const field of categoryFieldsFor(category)) if (fieldIsVisible(field, 'sell', {}, 'in')) seen.add(field.key);
    for (const key of ['reraRegistered', 'ownership', 'fireNoc']) expect(seen).toContain(key);
  });

  it('require nothing the US does not show', () => {
    for (const category of MARKETS.us.categories) {
      for (const tx of postableTransactionTypes(category, 'us')) {
        const keys = listingAttributeIssues(category, tx, { ...defaultAttributesFor(category), fromBroker: 'yes' }, null, 'us').map((i) => i.key);
        for (const hidden of MARKETS.us.hiddenFieldKeys) expect(keys).not.toContain(hidden);
      }
    }
  });
});
