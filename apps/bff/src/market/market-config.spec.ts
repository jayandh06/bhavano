describe('market-config', () => {
  const original = process.env.MARKET;
  afterEach(() => {
    if (original === undefined) delete process.env.MARKET;
    else process.env.MARKET = original;
    jest.resetModules();
  });

  function load(value: string | undefined) {
    if (value === undefined) delete process.env.MARKET;
    else process.env.MARKET = value;
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('./market-config') as typeof import('./market-config');
  }

  it('is India when MARKET is unset, empty or unknown', () => {
    for (const v of [undefined, '', 'xx']) {
      const m = load(v);
      expect(m.MARKET.id).toBe('in');
      expect(m.MARKET_TIME_ZONE).toBe('Asia/Kolkata');
    }
  });

  it('follows MARKET=us', () => {
    const m = load('us');
    expect(m.MARKET.id).toBe('us');
    expect(m.MARKET_TIME_ZONE).toBe('America/New_York');
  });
});
