import type { ConfigService } from '@nestjs/config';
import { matchCityName, sanitizeSearchInterpretation } from '@bhavano/types/searchInterpretation';
import type { PrismaService } from '../prisma/prisma.service';
import { SearchInterpretService } from './search-interpret.service';
import type { SearchInterpretLlm } from './search-interpret.llm';

const CITIES = ['Bengaluru', 'Hyderabad', 'Pune', 'Chennai'];

describe('sanitizeSearchInterpretation', () => {
  it('keeps valid fields and drops everything the app does not know', () => {
    const result = sanitizeSearchInterpretation(
      {
        transactionGroup: 'rent-lease',
        category: 'apartment',
        bedrooms: [3, 2, 2, 99, 'x'],
        minPrice: 15000,
        maxPrice: '25000',
        furnished: 'semi',
        postedBy: 'owner',
        cityName: 'Bengaluru',
        areaText: 'Whitefield',
        unmatched: ['bachelors allowed', '<script>'],
        evil: 'ignore me',
      },
      { cityNames: CITIES },
    );
    expect(result).toEqual({
      transactionGroup: 'rent-lease',
      category: 'apartment',
      bedrooms: [2, 3],
      minPrice: 15000,
      maxPrice: 25000,
      furnished: 'semi',
      postedBy: 'owner',
      cityName: 'Bengaluru',
      areaText: 'Whitefield',
      unmatched: ['bachelors allowed', 'script'],
    });
  });

  it('rejects unknown enum values and non-objects', () => {
    expect(sanitizeSearchInterpretation('hello', { cityNames: CITIES })).toBeNull();
    expect(sanitizeSearchInterpretation(null, { cityNames: CITIES })).toBeNull();
    expect(
      sanitizeSearchInterpretation({ category: 'castle', furnished: 'lavish', postedBy: 'agent', transactionGroup: 'swap' }, { cityNames: CITIES }),
    ).toBeNull();
  });

  it('swaps a reversed price range and clamps nonsense prices', () => {
    const swapped = sanitizeSearchInterpretation({ minPrice: 30000, maxPrice: 10000 }, { cityNames: CITIES });
    expect(swapped).toMatchObject({ minPrice: 10000, maxPrice: 30000 });
    const clamped = sanitizeSearchInterpretation({ category: 'plot', minPrice: -5, maxPrice: 1e15 }, { cityNames: CITIES });
    expect(clamped?.minPrice).toBeUndefined();
    expect(clamped?.maxPrice).toBeUndefined();
  });

  it('accepts a city only when it is a real one', () => {
    expect(sanitizeSearchInterpretation({ category: 'pg', cityName: 'Atlantis' }, { cityNames: CITIES })?.cityName).toBeUndefined();
    expect(sanitizeSearchInterpretation({ category: 'pg', cityName: 'bengaluru' }, { cityNames: CITIES })?.cityName).toBe('Bengaluru');
  });

  it('keeps at most four bedroom counts and four leftover phrases', () => {
    const result = sanitizeSearchInterpretation(
      { bedrooms: [1, 2, 3, 4, 5, 6], unmatched: ['aa', 'bb', 'cc', 'dd', 'ee'] },
      { cityNames: CITIES },
    );
    expect(result?.bedrooms).toEqual([1, 2, 3, 4]);
    expect(result?.unmatched).toHaveLength(4);
  });
});

describe('matchCityName', () => {
  it('fixes a one- or two-letter typo only when exactly one city is that close', () => {
    expect(matchCityName('Hyderbad', CITIES)).toBe('Hyderabad');
    expect(matchCityName('Pun', CITIES)).toBeUndefined(); // too short to guess
    expect(matchCityName('Bangalore', CITIES)).toBeUndefined(); // an alias, not a typo
  });
});

describe('SearchInterpretService', () => {
  function make(opts: { configured?: boolean; reply?: unknown; dailyLimit?: string } = {}) {
    const llm = {
      isConfigured: jest.fn().mockReturnValue(opts.configured ?? true),
      interpret: jest.fn().mockResolvedValue(opts.reply === undefined ? { category: 'pg', transactionGroup: 'rent-lease' } : opts.reply),
    };
    const prisma = { city: { findMany: jest.fn().mockResolvedValue(CITIES.map((name) => ({ name }))) } };
    const config = { get: jest.fn().mockReturnValue(opts.dailyLimit) };
    const service = new SearchInterpretService(prisma as unknown as PrismaService, llm as unknown as SearchInterpretLlm, config as unknown as ConfigService);
    return { service, llm };
  }

  it('answers null when AI is not configured, without calling anything', async () => {
    const { service, llm } = make({ configured: false });
    expect(await service.interpret('girls pg in hsr layout')).toEqual({ interpretation: null });
    expect(llm.interpret).not.toHaveBeenCalled();
  });

  it('caches the same sentence and city, case-insensitively', async () => {
    const { service, llm } = make();
    const first = await service.interpret('Girls PG in HSR', 'Bengaluru');
    const second = await service.interpret('girls pg in hsr', 'bengaluru');
    expect(second).toEqual(first);
    expect(llm.interpret).toHaveBeenCalledTimes(1);
  });

  it('does not cache a failed call, so the next try can succeed', async () => {
    const { service, llm } = make({ reply: null });
    expect(await service.interpret('2bhk furnished')).toEqual({ interpretation: null });
    await service.interpret('2bhk furnished');
    expect(llm.interpret).toHaveBeenCalledTimes(2);
  });

  it('stops calling the model after the daily cap', async () => {
    const { service, llm } = make({ dailyLimit: '2' });
    await service.interpret('one');
    await service.interpret('two');
    expect(await service.interpret('three')).toEqual({ interpretation: null });
    expect(llm.interpret).toHaveBeenCalledTimes(2);
  });

  it('returns null when the model reply holds nothing usable', async () => {
    const { service } = make({ reply: { category: 'castle' } });
    expect(await service.interpret('a castle')).toEqual({ interpretation: null });
  });
});
