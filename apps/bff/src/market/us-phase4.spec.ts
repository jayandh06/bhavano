import 'reflect-metadata';
import type { ListingCategory } from '@bhavano/types';
import {
  SECTION_ORDER,
  categoryFieldsFor,
  defaultAttributesFor,
  groupFieldsBySection,
  listingAttributeIssues,
  sectionOrderFor,
} from '@bhavano/types/categoryFields';
import { deriveCardSpecs } from '@bhavano/types/cardSpecs';
import { MARKETS } from '@bhavano/types/market';
import { marketDealIssue } from '@bhavano/types/postingRules';
import { annualRatePerSqft, formatAnnualRate, monthlyFromAnnualRate, showsAnnualRate } from '@bhavano/types/priceQualifiers';
import { listingPriceIssue } from '@bhavano/types/priceBounds';
import { MULTI_VALUE_FACTS, parseSearchFacts, searchFactsFor, searchFactValues } from '@bhavano/types/searchFacts';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ListListingsDto } from '../listings/dto/list-listings.dto';

/** Manufactured homes, the US commercial yearly rate and the US search filters (docs/plans/us-listing-model.md, phase 4). */

describe('manufactured homes', () => {
  it('are sold or rented in the US only', () => {
    expect(MARKETS.us.categories).toContain('manufactured');
    expect(MARKETS.in.categories).not.toContain('manufactured');
    expect(marketDealIssue('manufactured', 'sell', 'us')).toBeNull();
    expect(marketDealIssue('manufactured', 'rent', 'us')).toBeNull();
    expect(marketDealIssue('manufactured', 'lease', 'us')).not.toBeNull();
  });

  it('ask about the home and the land under it, with lot rent only on a leased lot', () => {
    const keys = categoryFieldsFor('manufactured', 'us').map((f) => f.key);
    expect(keys).toEqual(expect.arrayContaining(['bedrooms', 'carpetAreaSqft', 'homeWidth', 'lotOwnership', 'lotRent']));
    const filled = { ...defaultAttributesFor('manufactured', 'us'), carpetAreaSqft: '1200', fromBroker: 'no', lotOwnership: 'leased', lotRent: '450' };
    expect(listingAttributeIssues('manufactured', 'sell', filled, 90_000, 'us')).toEqual([]);
  });

  it('are priced in dollars', () => {
    expect(listingPriceIssue('manufactured', 'sell', 45_000, undefined, 'us')).toBeNull();
    expect(listingPriceIssue('manufactured', 'sell', 3_000_000, undefined, 'us')).not.toBeNull();
    expect(deriveCardSpecs('manufactured', { bedrooms: 2, bathrooms: 1, carpetAreaSqft: 900 }, 'us')).toEqual(['2 Beds', '1 Bath', '900 sqft']);
  });
});

describe('US commercial yearly rate', () => {
  it('applies to a US commercial lease only', () => {
    expect(showsAnnualRate('commercial', 'lease', 'us')).toBe(true);
    expect(showsAnnualRate('commercial', 'sell', 'us')).toBe(false);
    expect(showsAnnualRate('house', 'rent', 'us')).toBe(false);
    expect(showsAnnualRate('commercial', 'lease')).toBe(false);
  });

  it('turns a rate into the monthly rent and back to the cent', () => {
    const monthly = monthlyFromAnnualRate(24.5, 2_000)!;
    expect(monthly).toBe(4083);
    expect(formatAnnualRate(annualRatePerSqft(monthly, 2_000)!)).toBe('$24.50/sq ft/yr');
  });

  it('reads an area given in acres', () => {
    expect(monthlyFromAnnualRate(1, 1, 'acre')).toBe(Math.round(43_560 / 12));
  });

  it('says nothing without both figures', () => {
    expect(annualRatePerSqft(0, 2_000)).toBeNull();
    expect(annualRatePerSqft(4_000, Number.NaN)).toBeNull();
    expect(monthlyFromAnnualRate(24, 0)).toBeNull();
  });
});

describe('US search filters', () => {
  const keys = (category: ListingCategory) => searchFactsFor(category, 'us').map((f) => f.key);

  it('fit the category', () => {
    expect(keys('apartment')).toEqual(['laundry', 'parkingType', 'petPolicy']);
    expect(keys('manufactured')).toEqual(['laundry', 'parkingType', 'petPolicy', 'homeWidth']);
    expect(keys('commercial')).toEqual(['purpose']);
    expect(keys('storage')).toEqual(['storageType']);
    expect(keys('plot')).toEqual(['plotType']);
    expect(searchFactValues('petPolicy')).toEqual(['cats', 'dogs']);
    expect(MULTI_VALUE_FACTS.has('petPolicy')).toBe(true);
  });

  it('do not exist in India', () => {
    for (const category of MARKETS.in.categories) expect(searchFactsFor(category)).toEqual([]);
    expect(parseSearchFacts(() => 'in-unit')).toEqual({});
  });

  it('drop unknown values from a page address', () => {
    const query: Record<string, string> = { laundry: 'in-unit', purpose: 'nonsense', petPolicy: 'dogs' };
    expect(parseSearchFacts((key) => query[key], 'us')).toEqual({ laundry: 'in-unit', petPolicy: 'dogs' });
  });

  it('are accepted by the server only with a known value', () => {
    const errors = (query: Record<string, string>) => validateSync(plainToInstance(ListListingsDto, query)).map((e) => e.property);
    expect(errors({ laundry: 'in-unit', petPolicy: 'cats', plotType: 'residential' })).toEqual([]);
    expect(errors({ laundry: 'roof' })).toEqual(['laundry']);
  });
});

describe('US form order', () => {
  it('asks a commercial space’s area before its price, and leaves India’s order alone', () => {
    const sections = groupFieldsBySection(categoryFieldsFor('commercial', 'us'), 'us').map((s) => s.section);
    expect(sections.indexOf('spaceDetails')).toBeLessThan(sections.indexOf('pricing'));
    expect(sectionOrderFor()).toBe(SECTION_ORDER);
    expect([...sectionOrderFor('us')].sort()).toEqual([...SECTION_ORDER].sort());
    const india = groupFieldsBySection(categoryFieldsFor('commercial')).map((s) => s.section);
    expect(india.indexOf('pricing')).toBeLessThan(india.indexOf('spaceDetails'));
  });
});
