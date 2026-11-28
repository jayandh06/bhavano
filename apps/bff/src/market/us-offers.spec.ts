import { entitlementFor } from '@bhavano/types/market';

/** Nothing is sold in the US, so the server offers nothing there (docs/plans/us-market-expansion.md, "Paid offers hidden"). */

const settings = { enabled: true, listingCardEnabled: true, minAgeDays: 3 };

/** The market is read once at import time, so each market loads its own copy of the modules. */
async function inMarket<T>(market: 'in' | 'us', run: (load: (path: string) => any) => Promise<T>): Promise<T> {
  const previous = process.env.MARKET;
  process.env.MARKET = market;
  try {
    let result: Promise<T> | undefined;
    jest.isolateModules(() => {
      jest.doMock('../featured-upsell/featured-upsell-settings', () => ({ getFeaturedUpsellSettings: async () => settings }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      result = run((path) => require(path));
    });
    return await result!;
  } finally {
    if (previous === undefined) delete process.env.MARKET;
    else process.env.MARKET = previous;
  }
}

describe('upload limits', () => {
  const limit = { maxPhotos: 6, canUpgradeByBoosting: true };

  it('keep offering the Featured upgrade in India', () => {
    expect(entitlementFor('in', limit)).toBe(limit);
  });

  it('offer no upgrade in the US, with the limit itself unchanged', () => {
    expect(entitlementFor('us', limit)).toEqual({ maxPhotos: 6, canUpgradeByBoosting: false });
  });
});

describe('the Featured prompt settings', () => {
  const read = (market: 'in' | 'us') =>
    inMarket(market, (load) => {
      const { FeaturedUpsellController } = load('../featured-upsell/featured-upsell.controller');
      return new FeaturedUpsellController({}).settings();
    });

  it('follow the admin switches in India', async () => {
    await expect(read('in')).resolves.toEqual(settings);
  });

  it('are off in the US whatever the switches say', async () => {
    await expect(read('us')).resolves.toEqual({ ...settings, enabled: false, listingCardEnabled: false });
  });
});

describe('referral rewards', () => {
  it('are not granted in the US, since the reward is a free Featured ad', async () => {
    const findUnique = jest.fn();
    await inMarket('us', (load) => {
      const { ReferralsService } = load('../referrals/referrals.service');
      return ReferralsService.prototype.grantReward.call({ prisma: { referralCreditBatch: { findUnique } } }, 'r1', 'u1');
    });
    expect(findUnique).not.toHaveBeenCalled();
  });
});
