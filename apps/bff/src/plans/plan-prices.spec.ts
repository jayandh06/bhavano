import {
  DEFAULT_SUBSCRIPTION_PLAN_SETTINGS,
  US_SUBSCRIPTION_PLAN_SETTINGS,
  defaultSubscriptionPlanSettings,
  usdTierFromInr,
} from '@bhavano/types/subscriptionPricing';

describe('usdTierFromInr (the rupee amount divided by 60, rounded up to the next $5)', () => {
  it("reproduces the owner's examples", () => {
    expect(usdTierFromInr(199)).toBe(5);
    expect(usdTierFromInr(799)).toBe(15);
    expect(usdTierFromInr(1200)).toBe(20);
  });

  it('rounds up and never goes below $5', () => {
    expect(usdTierFromInr(1)).toBe(5);
    expect(usdTierFromInr(300)).toBe(5); // exactly 5.00
    expect(usdTierFromInr(301)).toBe(10);
    expect(usdTierFromInr(1201)).toBe(25);
  });
});

describe('US plan prices', () => {
  const keys = [
    'sellerSlotPackMonthlyPrice',
    'agentProMonthlyPricePerUnit',
    'buyerPremiumPrice1Month',
    'buyerPremiumPrice6Months',
    'buyerPremiumPrice12Months',
  ] as const;

  it("are the rule applied to India's amounts, so the two cannot drift apart", () => {
    for (const key of keys) {
      expect(US_SUBSCRIPTION_PLAN_SETTINGS[key]).toBe(usdTierFromInr(DEFAULT_SUBSCRIPTION_PLAN_SETTINGS[key]));
    }
  });

  it('keep the same slot counts as India', () => {
    expect(US_SUBSCRIPTION_PLAN_SETTINGS.freeListingSlots).toBe(DEFAULT_SUBSCRIPTION_PLAN_SETTINGS.freeListingSlots);
    expect(US_SUBSCRIPTION_PLAN_SETTINGS.sellerSlotPackTotalSlots).toBe(DEFAULT_SUBSCRIPTION_PLAN_SETTINGS.sellerSlotPackTotalSlots);
    expect(US_SUBSCRIPTION_PLAN_SETTINGS.proListingSlotsPerUnit).toBe(DEFAULT_SUBSCRIPTION_PLAN_SETTINGS.proListingSlotsPerUnit);
  });

  it("leave India's numbers exactly as they were", () => {
    expect(DEFAULT_SUBSCRIPTION_PLAN_SETTINGS).toEqual({
      freeListingSlots: 5,
      sellerSlotPackTotalSlots: 10,
      sellerSlotPackMonthlyPrice: 149,
      proListingSlotsPerUnit: 20,
      agentProMonthlyPricePerUnit: 499,
      buyerPremiumPrice1Month: 99,
      buyerPremiumPrice6Months: 549,
      buyerPremiumPrice12Months: 899,
    });
    expect(defaultSubscriptionPlanSettings()).toBe(DEFAULT_SUBSCRIPTION_PLAN_SETTINGS);
    expect(defaultSubscriptionPlanSettings('in')).toBe(DEFAULT_SUBSCRIPTION_PLAN_SETTINGS);
    expect(defaultSubscriptionPlanSettings('us')).toBe(US_SUBSCRIPTION_PLAN_SETTINGS);
  });
});

describe('the BFF defaults follow the stack market', () => {
  const load = (market: string | undefined) => {
    let out: {
      plans: typeof import('./plans.constants');
      reveal: typeof import('../contact-reveal/contact-reveal.constants');
    } | undefined;
    const previous = process.env.MARKET;
    if (market === undefined) delete process.env.MARKET;
    else process.env.MARKET = market;
    try {
      jest.isolateModules(() => {
        out = {
          plans: require('./plans.constants'),
          reveal: require('../contact-reveal/contact-reveal.constants'),
        };
      });
    } finally {
      if (previous === undefined) delete process.env.MARKET;
      else process.env.MARKET = previous;
    }
    return out!;
  };

  it('is India with no MARKET set, as every existing deployment is', () => {
    const { plans, reveal } = load(undefined);
    expect(plans.DEFAULT_SUBSCRIPTION_PLAN_SETTINGS.sellerSlotPackMonthlyPrice).toBe(149);
    expect(plans.DEFAULT_SUBSCRIPTION_PLAN_SETTINGS.buyerPremiumPrice12Months).toBe(899);
    expect(reveal.DEFAULT_CONTACT_REVEAL_SETTINGS.creditPackPriceRupees).toBe(125);
  });

  it('is the US tiers with MARKET=us, and the credit pack is $5 (Rs 125 through the same rule)', () => {
    const { plans, reveal } = load('us');
    expect(plans.DEFAULT_SUBSCRIPTION_PLAN_SETTINGS).toEqual(US_SUBSCRIPTION_PLAN_SETTINGS);
    expect(reveal.DEFAULT_CONTACT_REVEAL_SETTINGS.creditPackPriceRupees).toBe(usdTierFromInr(125));
    expect(reveal.DEFAULT_CONTACT_REVEAL_SETTINGS.creditPackSize).toBe(5);
  });
});
