import { goLiveTimeText } from '@bhavano/types/goLive';
import { formatInrInWords, formatInrRangeWithWords, formatInrWithWords, groupInr, perUnitTotalPrice, priceWordsNote } from '@bhavano/types/priceWords';
import {
  DEFAULT_MARKET_ID,
  MARKETS,
  formatMoney,
  groupAmount,
  getMarket,
  isValidNationalPhone,
  nationalPhoneDigits,
  phoneErrorMessage,
  toE164,
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

describe('phone helpers', () => {
  // The implementation that existed before the market config (outreach/phone.ts).
  function legacyIndia(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 10) return /^[6-9]/.test(digits) ? `+91${digits}` : null;
    if (digits.length === 11 && digits.startsWith('0')) return legacyIndia(digits.slice(1));
    if (digits.length === 12 && digits.startsWith('91')) return legacyIndia(digits.slice(2));
    return null;
  }

  it('normalises India exactly as before', () => {
    const inputs = [
      '9876543210', '98765 43210', '+91-9876543210', '919876543210', '09876543210', '+91 98765 43210',
      '1234567890', '12345', '', null, undefined, '0919876543210', '9198765432101', '5876543210', '98765-43210',
    ];
    for (const raw of inputs) expect(toE164('in', raw)).toBe(legacyIndia(raw as string));
  });

  it('normalises US numbers', () => {
    for (const raw of ['4155552671', '(415) 555-2671', '+1 415 555 2671', '1-415-555-2671', '415.555.2671']) {
      expect(toE164('us', raw)).toBe('+14155552671');
    }
    expect(nationalPhoneDigits('us', '0155552671')).toBeNull();
    expect(nationalPhoneDigits('us', '4151552671')).toBeNull();
    expect(nationalPhoneDigits('us', '12345')).toBeNull();
  });

  it('keeps the India validation message', () => {
    expect(phoneErrorMessage('in')).toBe('phone must be a 10-digit Indian mobile number');
    expect(phoneErrorMessage('us')).toBe('phone must be a 10-digit US phone number');
  });
});

describe('money formatting', () => {
  // The implementations before the market config (packages/types/src/priceWords.ts).
  const SCALES = [
    { value: 10_000_000, word: 'Crore' },
    { value: 100_000, word: 'Lakh' },
    { value: 1_000, word: 'Thousand' },
  ];
  const scaled = (a: number, scale: number) => String(Math.floor((a * 100) / scale + 1e-9) / 100);
  function legacyWords(amount: number): string {
    const r = Math.round(amount);
    for (const { value, word } of SCALES) if (r >= value) return `₹${scaled(r, value)} ${word}`;
    return `₹${r}`;
  }
  const legacyWithWords = (a: number) => {
    const price = `₹${groupInr(a)}`;
    const note = priceWordsNote(price, legacyWords(a));
    return note ? `${price} (${note})` : price;
  };
  const AMOUNTS = [0, 5, 500, 999, 1000, 23_500, 99_999, 100_000, 3_500_000, 9_999_999, 10_000_000, 125_000_000, 1_234_567_890];

  it('keeps India output identical', () => {
    for (const a of AMOUNTS) {
      expect(groupAmount('in', a)).toBe(groupInr(a));
      expect(formatMoney('in', a)).toBe(`₹${groupInr(a)}`);
      expect(formatInrInWords(a)).toBe(legacyWords(a));
      expect(formatInrInWords(a, 'in')).toBe(legacyWords(a));
      expect(formatInrWithWords(a)).toBe(legacyWithWords(a));
      expect(perUnitTotalPrice(a, 1200, 'sqft')).toEqual({
        price: `₹${groupInr(a)}`,
        priceInWords: legacyWords(a),
        area: perUnitTotalPrice(a, 1200, 'sqft').area,
      });
    }
    expect(formatInrRangeWithWords(3_000_000, 6_000_000)).toBe('₹30,00,000 – ₹60,00,000 (30 Lakh – 60 Lakh)');
    expect(formatInrRangeWithWords(null, 6_000_000)).toBe('up to ₹60,00,000 (60 Lakh)');
    expect(formatInrRangeWithWords(15_000, null)).toBe('from ₹15,000 (15 Thousand)');
    expect(formatInrRangeWithWords(500, 900)).toBe('₹500 – ₹900');
    expect(formatInrRangeWithWords(null, null)).toBeUndefined();
  });

  it('formats US amounts with thousands grouping and no lakh/crore words', () => {
    expect(groupAmount('us', 1_250_000)).toBe('1,250,000');
    expect(formatMoney('us', 1250)).toBe('$1,250');
    expect(formatMoney('us', 950)).toBe('$950');
    expect(formatMoney('us', -1250)).toBe('-$1,250');
    expect(formatInrInWords(3_500_000, 'us')).toBe('$3,500,000');
    expect(formatInrWithWords(3_500_000, 'us')).toBe('$3,500,000');
    expect(formatInrRangeWithWords(1500, 2500, 'us')).toBe('$1,500 – $2,500');
    expect(perUnitTotalPrice(600_000, 1200, 'sqft', 'us').price).toBe('$600,000');
  });
});
