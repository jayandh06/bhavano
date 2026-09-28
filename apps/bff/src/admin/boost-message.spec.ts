import { buildBoostMessageBody } from './boost-message';

const base = {
  title: '2 BHK in Koramangala',
  location: 'Koramangala, Bengaluru',
  boostPrice: 99,
  bundlePrice: 124,
  boostDays: 7,
  boostLink: 'https://www.bhavano.com/my-listings?openBoost=l1',
  bundleLink: 'https://www.bhavano.com/my-listings?openBoost=l1&withAlerts=1',
};

describe('buildBoostMessageBody', () => {
  it('leads with the whole pitch, since that is all a push preview shows', () => {
    const body = buildBoostMessageBody(base);
    expect(body.split('\n')[0]).toBe('Get more views on "2 BHK in Koramangala": boost it for 7 days for ₹99.');
  });

  it('quotes the charged prices and both links, and names the location', () => {
    const body = buildBoostMessageBody(base);
    expect(body).toContain('Boost + Instant Alerts: ₹124: https://www.bhavano.com/my-listings?openBoost=l1&withAlerts=1');
    expect(body).toContain('Boost my ad: https://www.bhavano.com/my-listings?openBoost=l1');
    expect(body).toContain('unboosted listings in Koramangala, Bengaluru');
  });

  it('switches to the offer wording, with the undiscounted price and the end date', () => {
    const body = buildBoostMessageBody({
      ...base,
      boostPrice: 50,
      bundlePrice: 62,
      offer: { discountPercent: 50, boostBasePrice: 99, bundleBasePrice: 124, endsOn: '30 September' },
    });
    expect(body.split('\n')[0]).toBe(
      'Get more views on "2 BHK in Koramangala": boost it for 7 days at ₹50 (was ₹99). 50% off until 30 September — applied for you, no code needed.',
    );
    expect(body).toContain('Boost + Instant Alerts: ₹62 (was ₹124)');
  });

  it('does not promise a guaranteed top slot — the featured tier is capped', () => {
    expect(buildBoostMessageBody(base)).not.toMatch(/top of|first place|#1|guarantee/i);
  });
});
