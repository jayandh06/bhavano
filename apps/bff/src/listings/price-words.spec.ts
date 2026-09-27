import { formatInrInWords } from '@bhavano/types/priceWords';

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
