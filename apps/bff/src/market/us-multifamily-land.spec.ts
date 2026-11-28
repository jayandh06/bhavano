import type { ListingCategory } from '@bhavano/types';
import {
  CATEGORY_FIELD_CONFIG,
  categoryFieldsFor,
  defaultAttributesFor,
  groupFieldsBySection,
  groupSectionFields,
  listingAttributeIssues,
} from '@bhavano/types/categoryFields';
import { deriveCardSpecs } from '@bhavano/types/cardSpecs';
import { deriveTag } from '@bhavano/types/listingTag';
import { MARKETS } from '@bhavano/types/market';
import { marketPostCategories, POST_CATEGORIES } from '@bhavano/types/postCategories';
import { allowsPerUnitPrice, marketDealIssue } from '@bhavano/types/postingRules';
import { listingPriceIssue } from '@bhavano/types/priceBounds';
import { formatRequirementLabel, requirementCategoryLabel, requirementQuestionsFor, sizeQuestionFor } from '@bhavano/types/requirementQuestions';
import { sellerTypeFromBroker } from '@bhavano/types/sellerType';

/** Multi-family buildings and Land in the US (docs/plans/us-listing-model.md, phase 3). India has neither change. */

const NEW: ListingCategory[] = ['multifamily', 'plot'];

describe('multi-family and land', () => {
  it('are sold in the US, and India gains nothing', () => {
    for (const category of NEW) {
      expect(MARKETS.us.categories).toContain(category);
      expect(marketDealIssue(category, 'sell', 'us')).toBeNull();
      expect(marketDealIssue(category, 'rent', 'us')).not.toBeNull();
    }
    expect(MARKETS.in.categories).not.toContain('multifamily');
    expect(marketPostCategories('in')).toBe(POST_CATEGORIES);
  });

  it('are named the US way', () => {
    const labels = Object.fromEntries(marketPostCategories('us').map((c) => [c.value, c.label]));
    expect(labels).toMatchObject({ multifamily: 'Multi-family', plot: 'Land' });
    expect(requirementCategoryLabel('plot', 'us')).toBe('Land');
    expect(requirementCategoryLabel('plot')).toBe('Plot');
    expect(deriveTag({ category: 'plot', transactionType: 'sell' }, 'us')).toBe('LAND');
    expect(deriveTag({ category: 'plot', transactionType: 'sell' })).toBe('PLOT');
  });

  it('ask US questions, with every field in a named group', () => {
    expect(categoryFieldsFor('multifamily', 'us').map((f) => f.key)).toEqual(
      expect.arrayContaining(['unitCount', 'carpetAreaSqft', 'lotSizeAcres', 'yearBuilt', 'yearlyGrossRent', 'fromBroker']),
    );
    const land = categoryFieldsFor('plot', 'us').map((f) => f.key);
    expect(land).toEqual(expect.arrayContaining(['plotAreaSqft', 'plotType', 'utilitiesAvailable', 'roadAccess', 'fromBroker']));
    for (const key of ['facing', 'titleDocuments', 'approvedBy', 'reraRegistered']) expect(land).not.toContain(key);
    expect(CATEGORY_FIELD_CONFIG.plot.map((f) => f.key)).toEqual(expect.arrayContaining(['facing', 'titleDocuments']));
    for (const category of NEW) {
      for (const section of groupFieldsBySection(categoryFieldsFor(category, 'us'), 'us')) {
        if (section.section === 'other') continue;
        expect(groupSectionFields(section.section, section.fields, 'us').map((g) => g.id)).not.toContain('more-details');
      }
    }
    expect(groupFieldsBySection(categoryFieldsFor('plot', 'us'), 'us').map((s) => s.label)).toContain('Land details');
  });

  it('can be posted with only what is required', () => {
    const answers: Record<string, Record<string, string>> = {
      multifamily: { unitCount: '4', carpetAreaSqft: '4800', fromBroker: 'no' },
      plot: { plotAreaSqft: '0.5', plotAreaSqftUnit: 'acre', fromBroker: 'yes' },
    };
    for (const category of NEW) {
      expect(listingAttributeIssues(category, 'sell', { ...defaultAttributesFor(category, 'us'), ...answers[category] }, 100_000, 'us')).toEqual([]);
    }
    expect(listingAttributeIssues('multifamily', 'sell', { unitCount: '1' }, null, 'us').map((i) => i.key)).toContain('unitCount');
    expect(sellerTypeFromBroker('yes')).toBeTruthy();
    expect(CATEGORY_FIELD_CONFIG.multifamily.some((f) => f.key === 'fromBroker')).toBe(true);
  });

  it('are priced in dollars within wide limits, land also per acre', () => {
    expect(listingPriceIssue('multifamily', 'sell', 2_500_000, undefined, 'us')).toBeNull();
    expect(listingPriceIssue('multifamily', 'sell', 20_000, undefined, 'us')).not.toBeNull();
    expect(listingPriceIssue('plot', 'sell', 5_000, undefined, 'us')).toBeNull();
    expect(listingPriceIssue('plot', 'sell', 60_000_000, undefined, 'us')).not.toBeNull();
    expect(allowsPerUnitPrice('sell', 'us')).toBe(true);
  });

  it('summarise on a card', () => {
    expect(deriveCardSpecs('multifamily', { unitCount: 4, carpetAreaSqft: 4800 }, 'us')).toEqual(['4 Units', '4,800 sqft']);
    expect(deriveCardSpecs('plot', { plotAreaSqft: 2, plotAreaSqftUnit: 'acre', plotType: 'residential' }, 'us').join(' ')).toMatch(/2 .*Residential/);
  });

  it('can be asked for by a buyer', () => {
    expect(sizeQuestionFor('plot', 'us')).toMatchObject({ kind: 'area', units: ['sqft', 'acre'] });
    expect(requirementQuestionsFor('plot', 'us')).toEqual([]);
    const label = (category: ListingCategory) =>
      formatRequirementLabel({ category, transactionType: 'sell', cityId: 'c', areaIds: ['a'] }, { cityName: 'Austin', areaNames: ['Downtown'] }, undefined, 'us');
    expect(label('plot')).toContain('Land to buy');
    expect(label('multifamily')).toContain('Multi-family building to buy');
  });
});
