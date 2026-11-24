import { toE164 } from './phone';

describe('toE164', () => {
  it('normalizes the formats the same number actually arrives in', () => {
    // The whole point of normalizing: these are one person, not five.
    for (const raw of ['9876543210', '98765 43210', '+91-9876543210', '919876543210', '09876543210']) {
      expect(toE164(raw)).toBe('+919876543210');
    }
  });

  it('rejects numbers that are not Indian mobiles', () => {
    expect(toE164('1234567890')).toBeNull(); // landline/garbage — mobiles start 6-9
    expect(toE164('12345')).toBeNull();
    expect(toE164('')).toBeNull();
    expect(toE164(null)).toBeNull();
    expect(toE164(undefined)).toBeNull();
  });
});
