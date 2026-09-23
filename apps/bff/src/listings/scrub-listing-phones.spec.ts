import { scrubPhonesInText } from './scrub-listing-phones';

describe('scrubPhonesInText', () => {
  it('masks a bare 10-digit mobile', () => {
    expect(scrubPhonesInText('Call 9876543210 today')).toBe('Call 98******10 today');
  });

  it('masks +91, 91, and leading-0 forms', () => {
    expect(scrubPhonesInText('WhatsApp +91 98765 43210')).toBe('WhatsApp 98******10');
    expect(scrubPhonesInText('Reach 919876543210')).toBe('Reach 98******10');
    expect(scrubPhonesInText('Dial 09876543210')).toBe('Dial 98******10');
  });

  it('masks spaced and dashed mobiles', () => {
    expect(scrubPhonesInText('Ph: 98765-43210')).toBe('Ph: 98******10');
    expect(scrubPhonesInText('Ph: 98765.43210')).toBe('Ph: 98******10');
  });

  it('masks every mobile in the string', () => {
    expect(scrubPhonesInText('A 9876543210 or B 9123456789')).toBe(
      'A 98******10 or B 91******89',
    );
  });

  it('leaves prices, pincodes, and short codes alone', () => {
    expect(scrubPhonesInText('Rent ₹25000 near 560076 OTP 123456')).toBe(
      'Rent ₹25000 near 560076 OTP 123456',
    );
  });

  it('leaves text with no phone unchanged', () => {
    expect(scrubPhonesInText('Spacious 2 BHK near metro')).toBe('Spacious 2 BHK near metro');
  });
});
