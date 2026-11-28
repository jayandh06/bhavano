import type { ListingCategory } from '@bhavano/types';
import {
  CATEGORY_FIELD_CONFIG,
  amenityFieldsFor,
  categoryFieldsFor,
  defaultAttributesFor,
  formatFieldLabel,
  formatFieldValue,
  groupSectionFields,
  listingAttributeIssues,
  numberFieldIssue,
  pruneHiddenAttributes,
} from '@bhavano/types/categoryFields';
import { deriveCardSpecs } from '@bhavano/types/cardSpecs';
import { reuseAttributes } from '@bhavano/types/listingReuse';
import { MARKETS } from '@bhavano/types/market';
import { postableTransactionTypes } from '@bhavano/types/postingRules';
import {
  amenityOptionsFor,
  formatRequirementLabel,
  requirementQuestionsFor,
  sanitizeRequirementAttributes,
} from '@bhavano/types/requirementQuestions';

/** The US's own listing form (docs/plans/us-listing-model.md, phase 2), with India beside it so a US change cannot move it. */

const keys = (category: ListingCategory) => categoryFieldsFor(category, 'us').map((f) => f.key);
const field = (category: ListingCategory, key: string) => categoryFieldsFor(category, 'us').find((f) => f.key === key)!;

describe('India', () => {
  it('still reads the shared list itself, with the same starting answers and amenities', () => {
    for (const category of Object.keys(CATEGORY_FIELD_CONFIG) as ListingCategory[]) {
      expect(categoryFieldsFor(category)).toBe(CATEGORY_FIELD_CONFIG[category]);
      expect(amenityFieldsFor(category)).toEqual(CATEGORY_FIELD_CONFIG[category].filter((f) => f.section === 'amenities'));
    }
    expect(defaultAttributesFor('apartment')).toMatchObject({ balconyCount: '0', vegetariansOnly: 'no' });
    expect(deriveCardSpecs('apartment', { bedrooms: 2, bathrooms: 2, carpetAreaSqft: 900 })).toEqual(['2 Beds', '2 Baths', '900 sqft']);
    expect(amenityOptionsFor('apartment').map((o) => o.label)).toContain('Power backup');
  });
});

describe('US listing form', () => {
  it('asks a home the US facts', () => {
    expect(keys('house')).toEqual(
      expect.arrayContaining(['halfBathrooms', 'yearBuilt', 'lotSizeAcres', 'parkingType', 'laundry', 'heating', 'cooling', 'hoaFee', 'leaseTerm', 'petPolicy']),
    );
    expect(keys('condo')).toContain('floor');
    expect(keys('condo')).not.toContain('lotSizeAcres');
    expect(keys('house')).not.toContain('floor');
  });

  it('asks none of India’s', () => {
    const gone = ['totalFloors', 'balconyCount', 'openParkingCount', 'monthlyMaintenanceFee', 'lockInPeriod', 'propertyAge', 'waterSupply', 'powerBackup', 'sofaCount'];
    for (const category of MARKETS.us.categories) for (const key of gone) expect(keys(category)).not.toContain(key);
    for (const category of MARKETS.us.categories) for (const key of keys(category)) expect(MARKETS.us.hiddenFieldKeys).not.toContain(key);
  });

  it('uses US words', () => {
    expect(field('apartment', 'carpetAreaSqft').label).toBe('Square feet');
    expect(field('apartment', 'societyName').label).toBe('Community / building name');
    expect(amenityOptionsFor('apartment', 'us').map((o) => o.label)).toEqual(
      ['Security cameras', 'Elevator', 'Fitness center', 'Pool', 'Clubhouse', 'Playground'],
    );
    const words = JSON.stringify(MARKETS.us.categories.map((c) => categoryFieldsFor(c, 'us')));
    expect(words).not.toMatch(/Godown|Carpet|Society|Lock-in|Club house|₹/);
  });

  it('never reads "no pets" as refusing assistance animals', () => {
    expect(formatFieldValue(field('apartment', 'petPolicy'), ['none'], 'us')).toBe('No pets (assistance animals are welcome)');
  });

  it('prints HOA and tax amounts in dollars', () => {
    expect(formatFieldLabel(field('house', 'hoaFee'))).toBe('Monthly HOA fee');
    expect(formatFieldValue(field('house', 'hoaFee'), 1_250, 'us')).toBe('$1,250');
  });

  it('can be filled in with only what is required', () => {
    for (const category of MARKETS.us.categories) {
      for (const tx of postableTransactionTypes(category, 'us')) {
        const attributes: Record<string, string | string[]> = defaultAttributesFor(category, 'us');
        for (const f of categoryFieldsFor(category, 'us')) {
          if (!f.required || attributes[f.key] !== undefined) continue;
          attributes[f.key] = f.options ? f.options[0].value : '900';
        }
        expect(listingAttributeIssues(category, tx, attributes, null, 'us')).toEqual([]);
      }
    }
  });

  it('starts with no India answers, and pre-fills no pet policy', () => {
    const defaults = defaultAttributesFor('apartment', 'us');
    expect(Object.keys(defaults).sort()).toEqual(['bathrooms', 'bedrooms', 'halfBathrooms']);
  });

  it('checks the year and the lot size', () => {
    expect(numberFieldIssue(field('house', 'yearBuilt'), 1998)).toBeNull();
    expect(numberFieldIssue(field('house', 'yearBuilt'), 98)).not.toBeNull();
    expect(numberFieldIssue(field('house', 'lotSizeAcres'), '0.25')).toBeNull();
  });

  it('keeps every US field in a named group', () => {
    for (const category of MARKETS.us.categories) {
      const fields = categoryFieldsFor(category, 'us');
      for (const section of new Set(fields.map((f) => f.section!))) {
        const groups = groupSectionFields(section, fields.filter((f) => f.section === section), 'us');
        expect(groups.map((g) => g.id)).not.toContain('more-details');
      }
    }
    const community = groupSectionFields('basics', categoryFieldsFor('house', 'us').filter((f) => f.section === 'basics'), 'us');
    expect(community.map((g) => g.label)).toContain('Community');
  });

  it('still strips answers it must not hold', () => {
    const attrs = { preferredTenantTypes: ['bachelor'], reraRegistered: 'yes', furnished: 'furnished' } as Record<string, string | string[]>;
    expect(pruneHiddenAttributes('apartment', 'rent', attrs, 'us')).toEqual({ furnished: 'furnished' });
  });
});

describe('US cards, reuse and requests', () => {
  it('counts half bathrooms on a card', () => {
    const attributes = { bedrooms: 3, bathrooms: 2, halfBathrooms: 1, carpetAreaSqft: 1800 };
    expect(deriveCardSpecs('house', attributes, 'us')).toEqual(['3 Beds', '2.5 Baths', '1,800 sqft']);
    expect(deriveCardSpecs('commercial', { sqft: 2000, purpose: 'hotel' }, 'us')).toContain('Hotel / hospitality');
  });

  it('reuses only US answers from a last ad', () => {
    const { attributes } = reuseAttributes('apartment', 'rent', {}, { cctv: 'yes', vegetariansOnly: 'yes', powerBackup: 'yes' }, 'us');
    expect(attributes).toEqual({ cctv: 'yes' });
  });

  it('asks a buyer the choices an ad offers', () => {
    const purpose = requirementQuestionsFor('commercial', 'us').find((q) => q.key === 'purpose')!;
    expect(purpose.options.map((o) => o.value)).toContain('hotel');
    expect(purpose.options.map((o) => o.value)).not.toContain('showroom');
    expect(sanitizeRequirementAttributes('commercial', 'lease', { purpose: ['hotel'] }, 'us')).toEqual({ attributes: { purpose: ['hotel'] }, errors: [] });
    const label = formatRequirementLabel(
      { category: 'apartment', transactionType: 'rent', cityId: 'c', areaIds: ['a'], attributes: { furnished: ['semi'], amenities: ['lift'] } },
      { cityName: 'Austin', areaNames: ['Downtown'] },
      undefined,
      'us',
    );
    expect(label).toContain('Partially furnished apartment');
    expect(label).toContain('elevator');
  });
});
