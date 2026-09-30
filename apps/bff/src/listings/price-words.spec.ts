import {
  compactPrice,
  formatInrInWords,
  formatInrRangeWithWords,
  formatInrWithWords,
  groupInr,
  listingHeadlinePrice,
  listingPriceText,
  perUnitTotalPrice,
  priceWithWords,
} from '@bhavano/types/priceWords';

describe('formatInrInWords', () => {
  it.each([
    [500, '₹500'],
    [1_000, '₹1 Thousand'],
    [12_500, '₹12.5 Thousand'],
    [35_000, '₹35 Thousand'],
    [99_999, '₹99.99 Thousand'],
    [1_00_000, '₹1 Lakh'],
    [3_50_000, '₹3.5 Lakh'],
    [35_00_000, '₹35 Lakh'],
    [37_49_999, '₹37.49 Lakh'],
    [99_99_999, '₹99.99 Lakh'],
    [1_00_00_000, '₹1 Crore'],
    [1_25_00_000, '₹1.25 Crore'],
    [12_00_00_000, '₹12 Crore'],
  ])('%i → %s', (amount, expected) => {
    expect(formatInrInWords(amount)).toBe(expected);
  });
});

describe('groupInr', () => {
  it.each([
    [0, '0'],
    [999, '999'],
    [1_000, '1,000'],
    [35_000, '35,000'],
    [3_50_000, '3,50,000'],
    [35_00_000, '35,00,000'],
    [1_25_00_000, '1,25,00,000'],
  ])('%i → %s', (amount, expected) => {
    expect(groupInr(amount)).toBe(expected);
  });
});

describe('number + words', () => {
  it('formats an amount as the exact figure then the words', () => {
    expect(formatInrWithWords(35_00_000)).toBe('₹35,00,000 (35 Lakh)');
    expect(formatInrWithWords(15_000)).toBe('₹15,000 (15 Thousand)');
    expect(formatInrWithWords(500)).toBe('₹500');
  });

  it('combines a listing DTO price pair, including per-unit and price on request', () => {
    expect(priceWithWords('₹35,00,000', '₹35 Lakh')).toBe('₹35,00,000 (35 Lakh)');
    expect(priceWithWords('₹5,000/cent', '₹5 Thousand/cent')).toBe('₹5,000/cent (5 Thousand/cent)');
    expect(priceWithWords('Contact for price', 'Contact for price')).toBe('Contact for price');
    expect(priceWithWords('₹35,00,000', undefined)).toBe('₹35,00,000');
  });

  it('formats budget ranges', () => {
    expect(formatInrRangeWithWords(30_00_000, 60_00_000)).toBe('₹30,00,000 – ₹60,00,000 (30 Lakh – 60 Lakh)');
    expect(formatInrRangeWithWords(undefined, 60_00_000)).toBe('up to ₹60,00,000 (60 Lakh)');
    expect(formatInrRangeWithWords(15_000, null)).toBe('from ₹15,000 (15 Thousand)');
    expect(formatInrRangeWithWords(null, null)).toBeUndefined();
  });
});

describe('compact price (browse cards, share text)', () => {
  it('uses the words from ₹1 lakh up and the plain number below', () => {
    expect(compactPrice('₹60,00,000', '₹60 Lakh')).toBe('₹60 Lakh');
    expect(compactPrice('₹1,25,00,000', '₹1.25 Crore')).toBe('₹1.25 Crore');
    expect(compactPrice('₹23,500', '₹23.5 Thousand')).toBe('₹23,500');
    expect(compactPrice('₹5,000/cent', '₹5 Thousand/cent')).toBe('₹5,000/cent');
    expect(compactPrice('Contact for price', 'Contact for price')).toBe('Contact for price');
    expect(compactPrice('₹60,00,000', undefined)).toBe('₹60,00,000');
  });
});

describe('per-unit listings lead with the total', () => {
  const perUnit = {
    price: '₹5,000/sq ft',
    priceInWords: '₹5 Thousand/sq ft',
    totalPrice: perUnitTotalPrice(60_00_000, 1200, 'sqft'),
  };

  it('builds the total from the stored price and area', () => {
    expect(perUnit.totalPrice).toEqual({ price: '₹60,00,000', priceInWords: '₹60 Lakh', area: '1,200 sq ft' });
  });

  it('keeps the rate as a second line', () => {
    expect(listingHeadlinePrice(perUnit)).toEqual({
      price: '₹60,00,000',
      priceInWords: '₹60 Lakh',
      rate: '₹5,000/sq ft · 1,200 sq ft',
    });
    expect(listingPriceText(perUnit, 'compact')).toBe('₹60 Lakh · ₹5,000/sq ft · 1,200 sq ft');
    expect(listingPriceText(perUnit, 'full')).toBe('₹60,00,000 (60 Lakh) · ₹5,000/sq ft · 1,200 sq ft');
  });

  it('leaves a whole price, or an older BFF without totalPrice, as it was', () => {
    const whole = { price: '₹35,00,000', priceInWords: '₹35 Lakh' };
    expect(listingHeadlinePrice(whole)).toEqual({ ...whole, rate: null });
    expect(listingPriceText(whole, 'compact')).toBe('₹35 Lakh');
    expect(listingPriceText(whole, 'full')).toBe('₹35,00,000 (35 Lakh)');
    expect(listingPriceText({ ...perUnit, totalPrice: null }, 'full')).toBe('₹5,000/sq ft (5 Thousand/sq ft)');
  });
});
