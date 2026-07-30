import { toE164India } from './phone';

describe('toE164India', () => {
  it('normalizes the formats the same number actually arrives in', () => {
    // The whole point of normalizing: these are one person, not five.
    for (const raw of ['9876543210', '98765 43210', '+91-9876543210', '919876543210', '09876543210']) {
      expect(toE164India(raw)).toBe('+919876543210');
    }
  });

  it('rejects numbers that are not Indian mobiles', () => {
    expect(toE164India('1234567890')).toBeNull(); // landline/garbage — mobiles start 6-9
    expect(toE164India('12345')).toBeNull();
    expect(toE164India('')).toBeNull();
    expect(toE164India(null)).toBeNull();
    expect(toE164India(undefined)).toBeNull();
  });
});
