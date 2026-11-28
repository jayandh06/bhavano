import { goLiveTimeText } from '@bhavano/types/goLive';
import { formatArea } from '@bhavano/types/areaUnit';
import { CATEGORY_FIELD_CONFIG, fieldIsVisible, listingAttributeIssues, pruneHiddenAttributes } from '@bhavano/types/categoryFields';
import { REQUIREMENT_ATTRIBUTE_QUESTIONS, requirementQuestionsFor, sanitizeRequirementAttributes } from '@bhavano/types/requirementQuestions';
import { POST_CATEGORY_GROUPS, marketPostCategoryGroups } from '@bhavano/types/postCategories';
import { formatInrInWords, formatInrRangeWithWords, formatInrWithWords, groupInr, perUnitTotalPrice, priceWordsNote } from '@bhavano/types/priceWords';
import {
  DEFAULT_MARKET_ID,
  MARKETS,
  formatMoney,
  groupAmount,
  getMarket,
  isMarketCategory,
  isMarketField,
  isValidNationalPhone,
  marketAreaUnits,
  marketDateFormatter,
  nationalPhoneDigits,
  phoneErrorMessage,
  toE164,
  marketFromPath,
  marketPath,
  stripMarketPrefix,
} from '@bhavano/types/market';

describe('market config', () => {
  it('defaults to India and falls back to it for anything unknown', () => {
    expect(DEFAULT_MARKET_ID).toBe('in');
    expect(getMarket().id).toBe('in');
    expect(getMarket(null).id).toBe('in');
    expect(getMarket('xx').id).toBe('in');
    expect(getMarket('us').id).toBe('us');
  });

  it("keeps India's values equal to what was hardcoded before", () => {
    const m = MARKETS.in;
    expect(m.timeZone).toBe('Asia/Kolkata');
    expect(m.locale).toBe('en-IN');
    expect(m.countryCode).toBe('IN');
    expect(m.currency).toBe('INR');
    expect(m.currencySymbol).toBe('₹');
    expect(m.pathPrefix).toBe('');
    expect(m.indexable).toBe(true);
    expect(m.phoneNationalPattern.source).toBe('^[6-9]\\d{9}$');
  });

  it('does not index the US until it is launched', () => {
    expect(MARKETS.us.indexable).toBe(false);
  });
});

describe('market paths', () => {
  it('leaves every India path untouched and claims only /us', () => {
    for (const p of ['/', '/bengaluru/buy/apartments', '/cities', '/usa-tools', '/user', '/us-visa', '/listings/abc']) {
      expect(marketFromPath(p)).toBe('in');
      expect(marketPath('in', p)).toBe(p);
      expect(stripMarketPrefix(p)).toBe(p);
    }
  });

  it('puts the US under /us', () => {
    expect(marketFromPath('/us')).toBe('us');
    expect(marketFromPath('/us/austin-tx/rent/apartments')).toBe('us');
    expect(marketFromPath('/us/austin-tx?x=1')).toBe('us');
    expect(marketPath('us', '/')).toBe('/us');
    expect(marketPath('us', '/austin-tx/rent')).toBe('/us/austin-tx/rent');
    expect(stripMarketPrefix('/us')).toBe('/');
    expect(stripMarketPrefix('/us/austin-tx/rent')).toBe('/austin-tx/rent');
  });
});

describe('market formatting and phone rules', () => {
  it('formats money per market', () => {
    expect(formatMoney('in', 1250000)).toBe('₹12,50,000');
    expect(formatMoney('us', 1250)).toBe('$1,250');
  });

  it('validates national phone numbers per market', () => {
    expect(isValidNationalPhone('in', '9876543210')).toBe(true);
    expect(isValidNationalPhone('in', '5876543210')).toBe(false);
    expect(isValidNationalPhone('us', '4155552671')).toBe(true);
    expect(isValidNationalPhone('us', '0155552671')).toBe(false);
  });
});

describe('goLiveTimeText stays identical for India', () => {
  // The implementation before the market config: hardcoded zone and locale.
  function legacy(publishAt: Date, now: Date): string {
    const zone = 'Asia/Kolkata';
    const clock = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: zone })
      .format(publishAt)
      .replace(/\s?(am|pm)/i, (_, ap: string) => ` ${ap.toLowerCase()}`);
    const dayKey = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(d);
    if (dayKey(publishAt) === dayKey(now)) return clock;
    const day = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: zone }).format(publishAt);
    return `${day}, ${clock}`;
  }

  it('matches the old output for same-day, other-day and invalid input', () => {
    const now = new Date('2026-10-23T05:00:00Z');
    const cases = [new Date('2026-10-23T10:10:00Z'), new Date('2026-10-24T03:30:00Z'), new Date('2026-12-31T18:29:00Z')];
    for (const c of cases) {
      expect(goLiveTimeText(c, now)).toBe(legacy(c, now));
      expect(goLiveTimeText(c, now, 'in')).toBe(legacy(c, now));
    }
    expect(goLiveTimeText('nope')).toBe('');
  });

  it('uses the US zone when asked', () => {
    const now = new Date('2026-10-23T05:00:00Z');
    expect(goLiveTimeText(new Date('2026-10-23T17:40:00Z'), now, 'us')).toMatch(/1:40 pm$/);
  });
});

describe('phone helpers', () => {
  // The implementation that existed before the market config (outreach/phone.ts).
  function legacyIndia(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 10) return /^[6-9]/.test(digits) ? `+91${digits}` : null;
    if (digits.length === 11 && digits.startsWith('0')) return legacyIndia(digits.slice(1));
    if (digits.length === 12 && digits.startsWith('91')) return legacyIndia(digits.slice(2));
    return null;
  }

  it('normalises India exactly as before', () => {
    const inputs = [
      '9876543210', '98765 43210', '+91-9876543210', '919876543210', '09876543210', '+91 98765 43210',
      '1234567890', '12345', '', null, undefined, '0919876543210', '9198765432101', '5876543210', '98765-43210',
    ];
    for (const raw of inputs) expect(toE164('in', raw)).toBe(legacyIndia(raw as string));
  });

  it('normalises US numbers', () => {
    for (const raw of ['4155552671', '(415) 555-2671', '+1 415 555 2671', '1-415-555-2671', '415.555.2671']) {
      expect(toE164('us', raw)).toBe('+14155552671');
    }
    expect(nationalPhoneDigits('us', '0155552671')).toBeNull();
    expect(nationalPhoneDigits('us', '4151552671')).toBeNull();
    expect(nationalPhoneDigits('us', '12345')).toBeNull();
  });

  it('keeps the India validation message', () => {
    expect(phoneErrorMessage('in')).toBe('phone must be a 10-digit Indian mobile number');
    expect(phoneErrorMessage('us')).toBe('phone must be a 10-digit US phone number');
  });
});

describe('money formatting', () => {
  // The implementations before the market config (packages/types/src/priceWords.ts).
  const SCALES = [
    { value: 10_000_000, word: 'Crore' },
    { value: 100_000, word: 'Lakh' },
    { value: 1_000, word: 'Thousand' },
  ];
  const scaled = (a: number, scale: number) => String(Math.floor((a * 100) / scale + 1e-9) / 100);
  function legacyWords(amount: number): string {
    const r = Math.round(amount);
    for (const { value, word } of SCALES) if (r >= value) return `₹${scaled(r, value)} ${word}`;
    return `₹${r}`;
  }
  const legacyWithWords = (a: number) => {
    const price = `₹${groupInr(a)}`;
    const note = priceWordsNote(price, legacyWords(a));
    return note ? `${price} (${note})` : price;
  };
  const AMOUNTS = [0, 5, 500, 999, 1000, 23_500, 99_999, 100_000, 3_500_000, 9_999_999, 10_000_000, 125_000_000, 1_234_567_890];

  it('keeps India output identical', () => {
    for (const a of AMOUNTS) {
      expect(groupAmount('in', a)).toBe(groupInr(a));
      expect(formatMoney('in', a)).toBe(`₹${groupInr(a)}`);
      expect(formatInrInWords(a)).toBe(legacyWords(a));
      expect(formatInrInWords(a, 'in')).toBe(legacyWords(a));
      expect(formatInrWithWords(a)).toBe(legacyWithWords(a));
      expect(perUnitTotalPrice(a, 1200, 'sqft')).toEqual({
        price: `₹${groupInr(a)}`,
        priceInWords: legacyWords(a),
        area: perUnitTotalPrice(a, 1200, 'sqft').area,
      });
    }
    expect(formatInrRangeWithWords(3_000_000, 6_000_000)).toBe('₹30,00,000 – ₹60,00,000 (30 Lakh – 60 Lakh)');
    expect(formatInrRangeWithWords(null, 6_000_000)).toBe('up to ₹60,00,000 (60 Lakh)');
    expect(formatInrRangeWithWords(15_000, null)).toBe('from ₹15,000 (15 Thousand)');
    expect(formatInrRangeWithWords(500, 900)).toBe('₹500 – ₹900');
    expect(formatInrRangeWithWords(null, null)).toBeUndefined();
  });

  it('formats US amounts with thousands grouping and no lakh/crore words', () => {
    expect(groupAmount('us', 1_250_000)).toBe('1,250,000');
    expect(formatMoney('us', 1250)).toBe('$1,250');
    expect(formatMoney('us', 950)).toBe('$950');
    expect(formatMoney('us', -1250)).toBe('-$1,250');
    expect(formatInrInWords(3_500_000, 'us')).toBe('$3,500,000');
    expect(formatInrWithWords(3_500_000, 'us')).toBe('$3,500,000');
    expect(formatInrRangeWithWords(1500, 2500, 'us')).toBe('$1,500 – $2,500');
    expect(perUnitTotalPrice(600_000, 1200, 'sqft', 'us').price).toBe('$600,000');
  });
});

describe('market categories and area units', () => {
  const INDIA_CATEGORIES = ['house', 'apartment', 'villa', 'pg', 'storage', 'coworking', 'furniture', 'interiors', 'plot', 'commercial'];
  const INDIA_UNITS = ['sqft', 'sqm', 'acre', 'hectare', 'cent'];

  it("keeps India's category and unit lists exactly as the DTOs had them", () => {
    expect(MARKETS.in.categories).toEqual(INDIA_CATEGORIES);
    expect(MARKETS.in.areaUnits).toEqual(INDIA_UNITS);
  });

  it('leaves the posting wizard groups unchanged for India', () => {
    // Pinned to what India's picker offered before the US-only categories (condo, townhouse, room) were added to POST_CATEGORY_GROUPS.
    const shape = (groups: typeof POST_CATEGORY_GROUPS) => groups.map((g) => ({ title: g.title, options: g.options.map((o) => o.value) }));
    expect(shape(marketPostCategoryGroups('in'))).toEqual([
      { title: 'Property', options: ['house', 'apartment', 'villa', 'plot', 'pg'] },
      { title: 'Commercial & workspace', options: ['commercial', 'coworking', 'storage'] },
    ]);
  });

  it('keeps every India unit list a field names, in order', () => {
    expect(marketAreaUnits('in')).toEqual(['sqft']);
    expect(marketAreaUnits('in', ['sqft', 'acre', 'cent', 'hectare', 'sqm'])).toEqual(['sqft', 'acre', 'cent', 'hectare', 'sqm']);
  });

  it('limits the US to the categories and units it offers', () => {
    const offered = marketPostCategoryGroups('us').flatMap((g) => g.options.map((o) => o.value));
    expect(offered).toEqual(expect.arrayContaining(['house', 'apartment', 'commercial', 'storage']));
    expect(offered).not.toEqual(expect.arrayContaining(['pg']));
    for (const c of ['pg', 'coworking', 'furniture', 'interiors', 'villa'] as const) {
      expect(isMarketCategory('us', c)).toBe(false);
      expect(offered).not.toContain(c);
    }
    expect(marketPostCategoryGroups('us').every((g) => g.options.length > 0)).toBe(true);
    expect(marketAreaUnits('us', ['sqft', 'acre', 'cent', 'hectare', 'sqm'])).toEqual(['sqft', 'acre']);
    expect(marketAreaUnits('us', ['cent'])).toEqual(['sqft']);
  });
});

describe('Fair Housing fields', () => {
  const HIDDEN = [
    'preferredTenantTypes',
    'vegetariansOnly',
    'gender',
    'foodType',
    'entranceFacing',
    // India-only questions (docs/plans/us-listing-model.md).
    'reraRegistered',
    'reraNumber',
    'waterSource',
    'gasPipeline',
    'ownership',
    'loanAvailable',
    'possessionStatus',
    'balconyCount',
    'fireNoc',
    'brokerageFeeApplicable',
    'brokerageFeeType',
    'brokerageFee',
    'brokerageCommissionPercent',
  ];

  it('hides nothing in India and the preference fields in the US', () => {
    expect(MARKETS.in.hiddenFieldKeys).toEqual([]);
    expect(MARKETS.us.hiddenFieldKeys).toEqual(HIDDEN);
    for (const k of HIDDEN) {
      expect(isMarketField('in', k)).toBe(true);
      expect(isMarketField('us', k)).toBe(false);
    }
  });

  it('keeps every field visible for India, with or without the market named', () => {
    for (const category of Object.keys(CATEGORY_FIELD_CONFIG) as (keyof typeof CATEGORY_FIELD_CONFIG)[]) {
      for (const field of CATEGORY_FIELD_CONFIG[category]) {
        for (const tx of ['buy', 'sell', 'rent', 'lease'] as const) {
          expect(fieldIsVisible(field, tx, {}, 'in')).toBe(fieldIsVisible(field, tx, {}));
        }
      }
    }
  });

  it('hides the tenant-preference fields on US rentals and strips their stale answers', () => {
    const apartment = CATEGORY_FIELD_CONFIG.apartment;
    const tenantType = apartment.find((f) => f.key === 'preferredTenantTypes')!;
    const veg = apartment.find((f) => f.key === 'vegetariansOnly')!;
    expect(fieldIsVisible(tenantType, 'rent', {})).toBe(true);
    expect(fieldIsVisible(tenantType, 'rent', {}, 'in')).toBe(true);
    expect(fieldIsVisible(tenantType, 'rent', {}, 'us')).toBe(false);
    expect(fieldIsVisible(veg, 'rent', {}, 'us')).toBe(false);
    const attrs = { preferredTenantTypes: ['bachelor'], vegetariansOnly: 'yes', furnished: 'furnished' } as Record<string, string | string[]>;
    expect(pruneHiddenAttributes('apartment', 'rent', attrs)).toEqual(attrs);
    expect(pruneHiddenAttributes('apartment', 'rent', attrs, 'us')).toEqual({ furnished: 'furnished' });
  });

  it('does not require a hidden field in the US', () => {
    const issues = listingAttributeIssues('pg', 'rent', {}, null, 'us').map((i) => i.key);
    expect(issues).not.toContain('gender');
    expect(listingAttributeIssues('pg', 'rent', {}, null).map((i) => i.key)).toContain('gender');
  });

  it('leaves India requirement questions whole and drops the tenant-type question in the US', () => {
    for (const c of Object.keys(REQUIREMENT_ATTRIBUTE_QUESTIONS) as (keyof typeof REQUIREMENT_ATTRIBUTE_QUESTIONS)[]) {
      expect(requirementQuestionsFor(c, 'in')).toEqual(REQUIREMENT_ATTRIBUTE_QUESTIONS[c]);
      expect(requirementQuestionsFor(c)).toEqual(REQUIREMENT_ATTRIBUTE_QUESTIONS[c]);
    }
    expect(requirementQuestionsFor('apartment', 'us').map((q) => q.key)).not.toContain('preferredTenantTypes');
    const india = sanitizeRequirementAttributes('apartment', 'rent', { preferredTenantTypes: ['family'] }, 'in');
    expect(india.errors).toEqual([]);
    expect(india.attributes.preferredTenantTypes).toEqual(['family']);
    const us = sanitizeRequirementAttributes('apartment', 'rent', { preferredTenantTypes: ['family'] }, 'us');
    expect(us.errors.length).toBeGreaterThan(0);
  });
});

describe('market dates and areas', () => {
  const D = new Date('2026-11-24T10:15:00Z');
  const OPTIONS: Intl.DateTimeFormatOptions[] = [
    { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' },
    { day: 'numeric', month: 'short', timeZone: 'UTC' },
    { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' },
    { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' },
  ];

  it('prints India dates exactly as en-IN did', () => {
    for (const o of OPTIONS) {
      expect(marketDateFormatter('in', o).format(D)).toBe(new Intl.DateTimeFormat('en-IN', o).format(D));
    }
    expect(marketDateFormatter('in', OPTIONS[0]).format(D)).toBe('24 Nov 2026');
  });

  it('prints US dates the US way', () => {
    expect(marketDateFormatter('us', OPTIONS[0]).format(D)).toBe('Nov 24, 2026');
    expect(marketDateFormatter('us', OPTIONS[1]).format(D)).toBe('Nov 24');
  });

  it('caches by market and options', () => {
    expect(marketDateFormatter('in', OPTIONS[0])).toBe(marketDateFormatter('in', OPTIONS[0]));
    expect(marketDateFormatter('in', OPTIONS[0])).not.toBe(marketDateFormatter('us', OPTIONS[0]));
  });

  it('formats areas with the market locale, India unchanged', () => {
    for (const [v, u] of [[1200, 'sqft'], [100000, 'sqft'], [2.5, 'acre'], [1, 'acre'], [1234567.891, 'sqm']] as const) {
      const legacy = `${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(v)} `;
      expect(formatArea(v, u).startsWith(legacy)).toBe(true);
      expect(formatArea(v, u, 'in')).toBe(formatArea(v, u));
    }
    expect(formatArea(100000, 'sqft')).toBe('1,00,000 sq ft');
    expect(formatArea(100000, 'sqft', 'us')).toBe('100,000 sq ft');
  });
});
