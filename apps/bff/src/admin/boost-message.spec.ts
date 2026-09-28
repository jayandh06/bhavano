import { buildBoostMessageBody } from './boost-message';

const base = {
  title: '2 BHK in Koramangala',
  location: 'Koramangala, Bengaluru',
  boostPrice: 99,
  boostDays: 7,
  boostLink: 'https://www.bhavano.com/my-listings?openBoost=l1',
};

describe('buildBoostMessageBody', () => {
  it('leads with the whole pitch, since that is all a push preview shows', () => {
    const body = buildBoostMessageBody(base);
    expect(body.split('\n')[0]).toBe('Get more views on "2 BHK in Koramangala": boost it for 7 days for ₹99.');
  });

  it('quotes the charged price, the link and the location', () => {
    const body = buildBoostMessageBody(base);
    expect(body).toContain('Boost my ad: https://www.bhavano.com/my-listings?openBoost=l1');
    expect(body).toContain('unboosted listings in Koramangala, Bengaluru');
  });

  it('describes Instant Alerts as included, never as an add-on with its own price', () => {
    const body = buildBoostMessageBody(base);
    expect(body).toContain('Instant Alerts is included');
    expect(body).not.toMatch(/\+\s*₹|add instant alerts/i);
  });

  it('quotes the longer option only when given one', () => {
    expect(buildBoostMessageBody(base)).not.toContain('run longer');
    const body = buildBoostMessageBody({ ...base, longer: { days: 30, price: 299 } });
    expect(body).toContain('Want it to run longer? 30 days is ₹299, a lower price per day.');
  });

  it('switches to the offer wording, with the undiscounted price and the end date', () => {
    const body = buildBoostMessageBody({
      ...base,
      boostPrice: 50,
      offer: { discountPercent: 50, boostBasePrice: 99, endsOn: '30 September' },
    });
    expect(body.split('\n')[0]).toBe(
      'Get more views on "2 BHK in Koramangala": boost it for 7 days at ₹50 (was ₹99). 50% off until 30 September, applied for you, no code needed.',
    );
  });

  it('does not promise a guaranteed top slot — the featured tier is capped', () => {
    expect(buildBoostMessageBody(base)).not.toMatch(/top of|first place|#1|guarantee/i);
  });
});
