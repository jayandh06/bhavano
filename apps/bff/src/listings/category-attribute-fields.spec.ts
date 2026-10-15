import type { ListingCategory, TransactionType } from '@bhavano/types';
import {
  CATEGORY_FIELD_CONFIG,
  fieldIsVisible,
  formatFieldLabel,
  formatFieldValue,
  listingAttributesIssue,
  pruneHiddenAttributes,
} from '@bhavano/types/categoryFields';

const field = (category: ListingCategory, key: string) => {
  const found = CATEGORY_FIELD_CONFIG[category].find((f) => f.key === key);
  if (!found) throw new Error(`${category} has no ${key} field`);
  return found;
};

const visible = (
  category: ListingCategory,
  transactionType: TransactionType,
  key: string,
  attributes: Record<string, unknown> = {},
) => fieldIsVisible(field(category, key), transactionType, attributes);

describe('rent / lease terms', () => {
  it.each<[ListingCategory]>([['house'], ['apartment'], ['villa'], ['commercial'], ['storage']])(
    '%s asks for deposit, availability and lock-in on rent and lease only',
    (category) => {
      for (const key of ['securityDeposit', 'availableFrom', 'lockInPeriod']) {
        expect(visible(category, 'rent', key)).toBe(true);
        expect(visible(category, 'lease', key)).toBe(true);
        if (category !== 'storage') expect(visible(category, 'sell', key)).toBe(false);
      }
    },
  );

  it('asks a PG and a coworking space for deposit and availability, not a lock-in', () => {
    for (const category of ['pg', 'coworking'] as const) {
      expect(visible(category, 'rent', 'securityDeposit')).toBe(true);
      expect(visible(category, 'rent', 'availableFrom')).toBe(true);
      expect(CATEGORY_FIELD_CONFIG[category].some((f) => f.key === 'lockInPeriod')).toBe(false);
    }
  });
});

describe('sale terms', () => {
  it('asks a sale for possession, age, ownership and RERA, and a rental for none of them', () => {
    for (const key of ['possessionStatus', 'propertyAge', 'ownership', 'reraRegistered', 'loanAvailable']) {
      expect(visible('apartment', 'sell', key)).toBe(true);
      expect(visible('apartment', 'rent', key)).toBe(false);
    }
    expect(visible('plot', 'sell', 'ownership')).toBe(true);
    expect(visible('commercial', 'sell', 'propertyAge')).toBe(true);
  });

  it('shows the RERA number once the listing says it is registered', () => {
    expect(visible('plot', 'sell', 'reraNumber', { reraRegistered: 'no' })).toBe(false);
    expect(visible('plot', 'sell', 'reraNumber', { reraRegistered: 'yes' })).toBe(true);
  });
});

describe('a multi-select gating another field', () => {
  it('shows a PG room rent for each sharing type ticked, and only those', () => {
    const attributes = { sharingType: ['single', 'triple'] };
    expect(visible('pg', 'rent', 'singleSharingRent', attributes)).toBe(true);
    expect(visible('pg', 'rent', 'tripleSharingRent', attributes)).toBe(true);
    expect(visible('pg', 'rent', 'doubleSharingRent', attributes)).toBe(false);
  });

  it('drops the rent of a sharing type that is un-ticked', () => {
    const pruned = pruneHiddenAttributes('pg', 'rent', {
      sharingType: ['single'],
      singleSharingRent: '9000',
      doubleSharingRent: '7000',
    });
    expect(pruned).toEqual({ sharingType: ['single'], singleSharingRent: '9000' });
  });

  it('shows coworking seat counts for the seat types offered', () => {
    expect(visible('coworking', 'rent', 'privateCabinCount', { seatType: ['private-cabin'] })).toBe(true);
    expect(visible('coworking', 'rent', 'hotDeskCount', { seatType: ['private-cabin'] })).toBe(false);
  });

  it('shows PG food type only when meals are included', () => {
    expect(visible('pg', 'rent', 'foodType', { meals: 'no' })).toBe(false);
    expect(visible('pg', 'rent', 'foodType', { meals: 'yes' })).toBe(true);
  });
});

describe('validation of the new fields', () => {
  const pg = { sharingType: ['single'] };

  it('accepts a PG without any of the new optional fields', () => {
    expect(listingAttributesIssue('pg', 'rent', pg)).toBeNull();
  });

  it('rejects an option the field does not offer', () => {
    expect(listingAttributesIssue('pg', 'rent', { ...pg, noticePeriod: '90' })).toBe(
      'Pick Notice period again',
    );
  });

  it('caps the commercial yearly rent increase', () => {
    const commercial = {
      sqft: '1000',
      purpose: 'office',
      furnished: 'unfurnished',
      fromBroker: 'no',
      washroomCount: '0',
      carParkingCount: '0',
    };
    expect(listingAttributesIssue('commercial', 'rent', { ...commercial, rentEscalationPercent: '10' })).toBeNull();
    expect(listingAttributesIssue('commercial', 'rent', { ...commercial, rentEscalationPercent: '40' })).toContain(
      'Yearly rent increase (%)',
    );
  });
});

describe('formatFieldValue', () => {
  it('prints a select by its label rather than its stored value', () => {
    expect(formatFieldValue(field('apartment', 'availableFrom'), 'within-15-days')).toBe('Within 15 days');
  });

  it('prints a multi-select by labels', () => {
    expect(formatFieldValue(field('plot', 'titleDocuments'), ['sale-deed', 'khata-patta'])).toBe(
      'Sale deed, Khata / patta',
    );
  });

  it('groups rupees the Indian way and drops the (₹) from the label', () => {
    const deposit = field('apartment', 'securityDeposit');
    expect(formatFieldValue(deposit, 150000)).toBe('₹1,50,000');
    expect(formatFieldLabel(deposit)).toBe('Security deposit');
  });

  it('adds a unit suffix', () => {
    expect(formatFieldValue(field('plot', 'roadWidthFt'), 30)).toBe('30 ft');
  });

  it('still prints yes/no and plain numbers as before', () => {
    expect(formatFieldValue(field('apartment', 'gatedCommunity'), 'yes')).toBe('Yes');
    expect(formatFieldValue(field('apartment', 'bedrooms'), 3)).toBe('3');
  });
});
