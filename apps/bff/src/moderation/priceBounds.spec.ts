import { listingPriceIssue } from '@bhavano/types/priceBounds';
import { checkPriceSanity } from './priceBounds';

describe('listingPriceIssue on a per-unit price', () => {
  it('accepts an ordinary per-sq-ft rate whose total is in range', () => {
    expect(listingPriceIssue('house', 'sell', 12_500 * 3_000, { price: 12_500, area: 3_000, unit: 'sqft' })).toBeNull();
  });

  it('rejects an inflated rate on the total, showing the working', () => {
    const issue = listingPriceIssue('house', 'sell', 12_320_000 * 3_000, { price: 12_320_000, area: 3_000, unit: 'sqft' });
    expect(issue).toMatch(/^₹1,23,20,000\/sq ft × 3,000 sq ft comes to ₹36,96,00,00,000 \(3696 Crore\)/);
    expect(issue).toMatch(/Check the price per sq ft and the area\.$/);
  });
});

describe('checkPriceSanity', () => {
  it('allows price: 0 for pg (a price-on-request category)', () => {
    expect(checkPriceSanity('pg', 'rent', 0)).toBeNull();
  });

  it('allows price: 0 for coworking (a price-on-request category)', () => {
    expect(checkPriceSanity('coworking', 'rent', 0)).toBeNull();
  });

  it('still rejects price: 0 for a category that is not price-on-request', () => {
    expect(checkPriceSanity('apartment', 'rent', 0)).toMatch(/outside the expected range/);
  });

  it('still rejects an out-of-bounds non-zero price on a price-on-request category', () => {
    // pg rental bounds are 1,000–100,000 — the price: 0 exemption is exact-zero only, not a
    // blanket bypass of the sanity check for these categories.
    expect(checkPriceSanity('pg', 'rent', 5_000_000)).toMatch(/outside the expected range/);
  });

  it('allows a normal in-range price', () => {
    expect(checkPriceSanity('pg', 'rent', 8_000)).toBeNull();
  });
});
