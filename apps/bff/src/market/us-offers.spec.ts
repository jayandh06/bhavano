import { MARKETS, appMarket, entitlementFor, getMarket } from '@bhavano/types/market';

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
    expect(entitlementFor(MARKETS.in.paymentsEnabled, limit)).toBe(limit);
  });

  it('offer no upgrade in the US, with the limit itself unchanged', () => {
    expect(entitlementFor(MARKETS.us.paymentsEnabled, limit)).toEqual({ maxPhotos: 6, canUpgradeByBoosting: false });
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

describe('what the apps sell', () => {
  const wasEnabled = MARKETS.us.paymentsEnabled;
  afterEach(() => {
    MARKETS.us.paymentsEnabled = wasEnabled;
  });

  it('is everything in India', () => {
    expect(appMarket('in')).toBe(MARKETS.in);
  });

  it('stays nothing in the US when its website starts selling', () => {
    MARKETS.us.paymentsEnabled = true;
    expect(appMarket('us').paymentsEnabled).toBe(false);
    expect(appMarket('us')).toBe(appMarket('us'));
    expect(appMarket('us').currency).toBe('USD');
  });
});

describe('the currency charged', () => {
  /** A contact-credit order with the market's payments switched on, whatever the shipped setting is. */
  const order = (market: 'in' | 'us') => {
    const create = jest.fn().mockResolvedValue({ id: 'order_1' });
    const payment = jest.fn().mockResolvedValue({ id: 'pay_1' });
    let result: Promise<unknown> | undefined;
    jest.isolateModules(() => {
      const config = { ...getMarket(market), paymentsEnabled: true };
      jest.doMock('./market-config', () => ({ MARKET: config, MARKET_TIME_ZONE: config.timeZone }));
      jest.doMock('razorpay', () => {
        class FakeRazorpay {
          orders = { create };
        }
        return { __esModule: true, default: FakeRazorpay };
      });
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { PaymentsService } = require('../payments/payments.service');
      result = PaymentsService.prototype.createContactRevealCreditsOrder.call(
        Object.assign(Object.create(PaymentsService.prototype), {
          prisma: { contactRevealSetting: { findUnique: jest.fn().mockResolvedValue(null) }, payment: { create: payment } },
          config: { get: () => 'key' },
          razorpay: null,
        }),
        'u1',
      );
    });
    return result!.then((response) => ({ response, create, payment }));
  };

  afterEach(() => {
    jest.dontMock('./market-config');
    jest.dontMock('razorpay');
  });

  it.each([
    ['in', 'INR', 12_500],
    ['us', 'USD', 500],
  ] as const)('is the market’s own (%s)', async (market, currency, amount) => {
    const { response, create, payment } = await order(market);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ amount, currency }));
    expect(payment).toHaveBeenCalledWith({ data: expect.objectContaining({ amount, currency }) });
    expect(response).toMatchObject({ amount, currency });
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
