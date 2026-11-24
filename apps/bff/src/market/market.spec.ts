import { goLiveTimeText } from '@bhavano/types/goLive';
import {
  DEFAULT_MARKET_ID,
  MARKETS,
  formatMoney,
  getMarket,
  isValidNationalPhone,
  marketFromPath,
  marketPath,
  stripMarketPrefix,
} from '@bhavano/types/market';

describe('market config', () => {
  it('defaults to India and falls back to it for anything unknown', () => {
    expect(DEFAULT_MARKET_ID).toBe('in');
    expect(getMarket().id).toBe('in');
    expect(getMarket(null).id).toBe('in');
    expect(getMarket('xx').id).toBe('in');
    expect(getMarket('us').id).toBe('us');
  });

  it("keeps India's values equal to what was hardcoded before", () => {
    const m = MARKETS.in;
    expect(m.timeZone).toBe('Asia/Kolkata');
    expect(m.locale).toBe('en-IN');
    expect(m.countryCode).toBe('IN');
    expect(m.currency).toBe('INR');
    expect(m.currencySymbol).toBe('₹');
    expect(m.pathPrefix).toBe('');
    expect(m.indexable).toBe(true);
    expect(m.phoneNationalPattern.source).toBe('^[6-9]\\d{9}$');
  });

  it('does not index the US until it is launched', () => {
    expect(MARKETS.us.indexable).toBe(false);
  });
});

describe('market paths', () => {
  it('leaves every India path untouched and claims only /us', () => {
    for (const p of ['/', '/bengaluru/buy/apartments', '/cities', '/usa-tools', '/user', '/us-visa', '/listings/abc']) {
      expect(marketFromPath(p)).toBe('in');
      expect(marketPath('in', p)).toBe(p);
      expect(stripMarketPrefix(p)).toBe(p);
    }
  });

  it('puts the US under /us', () => {
    expect(marketFromPath('/us')).toBe('us');
    expect(marketFromPath('/us/austin-tx/rent/apartments')).toBe('us');
    expect(marketFromPath('/us/austin-tx?x=1')).toBe('us');
    expect(marketPath('us', '/')).toBe('/us');
    expect(marketPath('us', '/austin-tx/rent')).toBe('/us/austin-tx/rent');
    expect(stripMarketPrefix('/us')).toBe('/');
    expect(stripMarketPrefix('/us/austin-tx/rent')).toBe('/austin-tx/rent');
  });
});

describe('market formatting and phone rules', () => {
  it('formats money per market', () => {
    expect(formatMoney('in', 1250000)).toBe('₹12,50,000');
    expect(formatMoney('us', 1250)).toBe('$1,250');
  });

  it('validates national phone numbers per market', () => {
    expect(isValidNationalPhone('in', '9876543210')).toBe(true);
    expect(isValidNationalPhone('in', '5876543210')).toBe(false);
    expect(isValidNationalPhone('us', '4155552671')).toBe(true);
    expect(isValidNationalPhone('us', '0155552671')).toBe(false);
  });
});

describe('goLiveTimeText stays identical for India', () => {
  // The implementation before the market config: hardcoded zone and locale.
  function legacy(publishAt: Date, now: Date): string {
    const zone = 'Asia/Kolkata';
    const clock = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: zone })
      .format(publishAt)
      .replace(/\s?(am|pm)/i, (_, ap: string) => ` ${ap.toLowerCase()}`);
    const dayKey = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(d);
    if (dayKey(publishAt) === dayKey(now)) return clock;
    const day = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: zone }).format(publishAt);
    return `${day}, ${clock}`;
  }

  it('matches the old output for same-day, other-day and invalid input', () => {
    const now = new Date('2026-10-23T05:00:00Z');
    const cases = [new Date('2026-10-23T10:10:00Z'), new Date('2026-10-24T03:30:00Z'), new Date('2026-12-31T18:29:00Z')];
    for (const c of cases) {
      expect(goLiveTimeText(c, now)).toBe(legacy(c, now));
      expect(goLiveTimeText(c, now, 'in')).toBe(legacy(c, now));
    }
    expect(goLiveTimeText('nope')).toBe('');
  });

  it('uses the US zone when asked', () => {
    const now = new Date('2026-10-23T05:00:00Z');
    expect(goLiveTimeText(new Date('2026-10-23T17:40:00Z'), now, 'us')).toMatch(/1:40 pm$/);
  });
});
