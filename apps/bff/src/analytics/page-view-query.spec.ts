import { readablePageViewQuery, sanitizePageViewQuery } from '@bhavano/types/pageViewQuery';

describe('sanitizePageViewQuery', () => {
  it('keeps the filters that say which page was seen', () => {
    expect(sanitizePageViewQuery('?bedrooms=2&minPrice=15000&sort=price_asc')).toBe(
      'bedrooms=2&minPrice=15000&sort=price_asc',
    );
  });

  it('drops ad click ids, campaign tags, referral codes, tokens and framework params', () => {
    expect(
      sanitizePageViewQuery('gclid=a&gbraid=b&utm_source=x&utm_medium=cpc&campaignid=1&ref=u1&token=t&code=1&_rsc=z&q=pg'),
    ).toBe('q=pg');
  });

  it('is null when nothing is left, or there is no query', () => {
    expect(sanitizePageViewQuery('gclid=a&utm_campaign=b')).toBeNull();
    expect(sanitizePageViewQuery('')).toBeNull();
    expect(sanitizePageViewQuery(undefined)).toBeNull();
  });

  it('re-encodes values, treating + as a space', () => {
    expect(sanitizePageViewQuery('q=2+bhk&area=HSR%20Layout')).toBe('q=2%20bhk&area=HSR%20Layout');
  });

  it('keeps a malformed escape as typed instead of failing', () => {
    expect(sanitizePageViewQuery('q=%E0%A4%A')).toBe('q=%25E0%25A4%25A');
  });

  it('caps each value at 80 characters and the whole string at 300, on a whole pair', () => {
    const long = sanitizePageViewQuery(`a=${'x'.repeat(500)}`);
    expect(long).toBe(`a=${'x'.repeat(80)}`);
    const many = sanitizePageViewQuery(Array.from({ length: 40 }, (_, i) => `k${i}=${'v'.repeat(20)}`).join('&'));
    expect(many!.length).toBeLessThanOrEqual(300);
    expect(many!.endsWith('v')).toBe(true);
  });
});

describe('readablePageViewQuery', () => {
  it('shows the stored query as plain words', () => {
    expect(readablePageViewQuery('area=HSR%20Layout&q=2%20bhk')).toBe('area=HSR Layout&q=2 bhk');
  });

  it('is empty for no query', () => {
    expect(readablePageViewQuery(null)).toBe('');
  });
});
