import { postAdValueRupees } from './post-ad-value';

describe('postAdValueRupees', () => {
  it('uses the segment-level value when the category+transactionType combination has one', () => {
    expect(postAdValueRupees('plot', 'sell')).toBe(2339);
    expect(postAdValueRupees('house', 'rent')).toBe(1743);
  });

  it('returns a real, confirmed zero for a segment that genuinely has no payers, not a fallback', () => {
    // villa|rent has its own entry precisely so it does NOT fall through to the villa category
    // value below — both happen to be 0 here, but the point is this is the segment's own number.
    expect(postAdValueRupees('villa', 'rent')).toBe(0);
  });

  it('falls back to the category-level value when the exact segment is too thin', () => {
    // "commercial|sell" has no entry in POST_AD_VALUE_BY_SEGMENT (only 4 posters) — falls back
    // to the "commercial" category value (41 posters).
    expect(postAdValueRupees('commercial', 'sell')).toBe(2288);
  });

  it('falls back to the account-wide average when even the category is too thin', () => {
    // "storage" has no entry at either level (3 posters) — falls all the way back.
    expect(postAdValueRupees('storage', 'rent')).toBe(1415);
    expect(postAdValueRupees('coworking', 'lease')).toBe(1415);
  });
});
