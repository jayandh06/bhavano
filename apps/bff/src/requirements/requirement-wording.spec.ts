import {
  budgetPresetsFor,
  formatCompactInr,
  formatCompactMoney,
  formatRequirementLabel,
  requirementIntentsFor,
  sizeQuestionFor,
  REQUIREMENT_INTENTS,
  type RequirementCriteria,
} from '@bhavano/types/requirementQuestions';
import { requirementBudgetIssue } from '@bhavano/types/priceBounds';

/** What a requirement is called in each market. India's wording is pinned here so a US change cannot move it. */
const home: RequirementCriteria = {
  category: 'apartment',
  transactionType: 'rent',
  cityId: 'c1',
  areaIds: ['a1'],
  bedroomOptions: [3, 2],
  minPrice: 20_000,
  maxPrice: 35_000,
};
const names = { cityName: 'Chennai', areaNames: ['Adyar'] };
const usNames = { cityName: 'Austin', areaNames: ['Downtown'] };
const us = (c: RequirementCriteria) => formatRequirementLabel(c, usNames, undefined, 'us');

describe('requirement wording', () => {
  it('writes India as before, with or without the market named', () => {
    const expected = '2 or 3 BHK apartment for rent in Adyar, Chennai · ₹20k–35k/month';
    expect(formatRequirementLabel(home, names)).toBe(expected);
    expect(formatRequirementLabel(home, names, undefined, 'in')).toBe(expected);
    expect(formatRequirementLabel({ ...home, transactionType: 'lease', minPrice: 500_000, maxPrice: undefined }, names)).toContain(
      'on lease in Adyar, Chennai · ₹5L+ lease',
    );
  });

  it('writes beds and dollars in the US', () => {
    expect(us({ ...home, minPrice: 1_500, maxPrice: 2_000 })).toBe('2 or 3 bed apartment for rent in Downtown, Austin · $1.5k–2k/month');
    expect(us({ ...home, transactionType: 'sell', minPrice: undefined, maxPrice: 1_250_000 })).toContain('to buy in Downtown, Austin · up to $1.25M');
    expect(us({ ...home, transactionType: 'lease', minPrice: 900, maxPrice: undefined })).toContain('for lease in Downtown, Austin · $900+/month');
  });

  it('writes US areas with US digit grouping', () => {
    const storage: RequirementCriteria = { category: 'storage', transactionType: 'rent', cityId: 'c1', minAreaSqft: 120_000 };
    expect(us(storage)).toContain('from 120,000 sq ft');
    expect(formatRequirementLabel(storage, names)).toContain('from 1,20,000 sq ft');
  });

  it('shortens money the Indian way in India and with k and M in the US', () => {
    for (const amount of [900, 25_000, 150_000, 20_000_000]) expect(formatCompactMoney(amount)).toBe(formatCompactInr(amount));
    expect([900, 2_500, 1_000_000].map((n) => formatCompactMoney(n, 'us'))).toEqual(['$900', '$2.5k', '$1M']);
  });

  it('offers rupee budget bands only in India', () => {
    expect(budgetPresetsFor('apartment', 'rent').presets.length).toBeGreaterThan(0);
    expect(budgetPresetsFor('apartment', 'rent', 'in')).toEqual(budgetPresetsFor('apartment', 'rent'));
    expect(budgetPresetsFor('apartment', 'rent', 'us')).toEqual({ unit: 'per month', presets: [] });
  });

  it('asks the US only for what it can post, in its own area units', () => {
    expect(requirementIntentsFor()).toBe(REQUIREMENT_INTENTS);
    expect(requirementIntentsFor('us').map((i) => i.value)).toEqual(['buy', 'rentLease']);
    expect(sizeQuestionFor('commercial')).toMatchObject({ units: ['sqft', 'sqm', 'acre', 'cent'] });
    expect(sizeQuestionFor('commercial', 'us')).toMatchObject({ units: ['sqft', 'acre'] });
    expect(sizeQuestionFor('condo', 'us')).toMatchObject({ kind: 'bedrooms' });
  });

  it('explains an out-of-range budget in the market currency', () => {
    expect(requirementBudgetIssue('apartment', 'rent', 7, 'us')).toBe(
      '$7 is outside the typical range for this category ($200 to $100,000)',
    );
    expect(requirementBudgetIssue('apartment', 'rent', 7)).toMatch(/^₹7 is outside the typical range for this category \(₹/);
    expect(requirementBudgetIssue('apartment', 'rent', 20_000, 'us')).toBeNull();
  });
});
