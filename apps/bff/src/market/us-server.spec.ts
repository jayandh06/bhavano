import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * What the server says and charges where nothing is sold (the US), with India beside it so a change to one cannot quietly move the other.
 * Modules read MARKET when first loaded, so each market loads its own copy of them.
 */
type Id = 'in' | 'us';

function load<T>(market: Id, path: string): T {
  const original = process.env.MARKET;
  process.env.MARKET = market;
  let loaded!: T;
  try {
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      loaded = require(path) as T;
    });
  } finally {
    if (original === undefined) delete process.env.MARKET;
    else process.env.MARKET = original;
  }
  return loaded;
}

const PAYMENTS_UNAVAILABLE = { response: { code: 'PAYMENTS_UNAVAILABLE' }, status: 403 };

describe('charging', () => {
  type Payments = typeof import('../payments/payments.service');
  const razorpay = (market: Id) => {
    const { PaymentsService } = load<Payments>(market, '../payments/payments.service');
    const getRazorpay = (PaymentsService.prototype as unknown as { getRazorpay: () => unknown }).getRazorpay;
    return () => getRazorpay.call({ config: { get: () => undefined } });
  };

  it('is refused in the US, even with a payment client configured', () => {
    expect(razorpay('us')).toThrow('Payments are not available yet.');
    try {
      razorpay('us')();
    } catch (error) {
      expect(error).toMatchObject(PAYMENTS_UNAVAILABLE);
    }
  });

  it('works as before in India', () => {
    expect(razorpay('in')).toThrow('Payments are not configured on this server yet');
  });

  it('is refused for an Apple purchase in the US, before anything is recorded', async () => {
    const { AppleIapService } = load<typeof import('../payments/apple/apple-iap.service')>('us', '../payments/apple/apple-iap.service');
    const intent = AppleIapService.prototype.createIntent.call({} as never, 'u1', { type: 'credits' });
    await expect(intent).rejects.toMatchObject(PAYMENTS_UNAVAILABLE);
  });
});

describe('an ad that asks for something paid', () => {
  const settings = { propertyListingFee: 99, coworkingPgStorageListingFee: 0, furnitureInteriorsListingFee: 0, allowLivePublishWithPendingPayment: false };
  const holds = (market: Id) => load<typeof import('../listings/holds-for-payment')>(market, '../listings/holds-for-payment').holdsForPayment;

  it('is posted live in the US, whatever the fee settings say', () => {
    expect(holds('us')('apartment', settings, true)).toBe(false);
    expect(holds('us')('apartment', settings, false)).toBe(false);
  });

  it('still waits for payment in India', () => {
    expect(holds('in')('apartment', settings, false)).toBe(true);
    expect(holds('in')('furniture', settings, true)).toBe(true);
    expect(holds('in')('furniture', settings, false)).toBe(false);
    expect(holds('in')('apartment', { ...settings, allowLivePublishWithPendingPayment: true }, true)).toBe(false);
  });
});

describe('paid offers in the US', () => {
  /** Any database or service access would throw: these must return before doing anything. */
  const untouchable = new Proxy({}, { get: (_t, key) => { throw new Error(`used ${String(key)}`); } }) as never;

  it('no boost nudge, follow-up or Featured-expiry reminder is sent', async () => {
    const { BoostNudgeJob } = load<typeof import('../admin/boost-nudge.job')>('us', '../admin/boost-nudge.job');
    const { BoostFollowupJob } = load<typeof import('../admin/boost-followup.job')>('us', '../admin/boost-followup.job');
    const { FeaturedExpiryReminderJob } = load<typeof import('../admin/featured-expiry-reminder.job')>('us', '../admin/featured-expiry-reminder.job');
    await expect(new BoostNudgeJob(untouchable, untouchable).nudgeQuietListings()).resolves.toBe(0);
    await expect(new BoostFollowupJob(untouchable, untouchable).sendFollowups()).resolves.toBe(0);
    await expect(new FeaturedExpiryReminderJob(untouchable, untouchable).sendReminders()).resolves.toBe(0);
  });

  it('the manual Boost message is refused and the expiry message does nothing', async () => {
    const { AdminService } = load<typeof import('../admin/admin.service')>('us', '../admin/admin.service');
    const boost = AdminService.prototype.sendBoostPromotion.call(untouchable, ['l1']);
    await expect(boost).rejects.toMatchObject(PAYMENTS_UNAVAILABLE);
    await expect(AdminService.prototype.sendFeaturedExpiryReminder.call(untouchable, 'l1', 1, 'admin1')).resolves.toBe(false);
  });

  it.each<[Id, boolean, string]>([
    ['us', false, 'How\'s "Loft" doing? Check your views and messages.'],
    ['in', false, '🌟 Feature "Loft" to get seen first'],
    ['in', true, 'How\'s "Loft" doing? Check your views and messages.'],
  ])('the posted reminder push in %s (featured: %s)', async (market, featured, body) => {
    const { PushService } = load<typeof import('../push/push.service')>(market, '../push/push.service');
    const sendToUser = jest.fn().mockResolvedValue(undefined);
    await PushService.prototype.notifyListingPostedReminder.call({ sendToUser } as never, 'u1', 'Loft', featured);
    expect(sendToUser).toHaveBeenCalledWith('u1', expect.objectContaining({ body }));
  });
});

describe('links in requirement messages', () => {
  function notifications(market: Id, env: Record<string, string> = {}) {
    const { NotificationsService } = load<typeof import('../notifications/notifications.service')>(market, '../notifications/notifications.service');
    const dispatch = jest.fn().mockResolvedValue('email');
    // Only what these two messages touch.
    const self = Object.assign(Object.create(NotificationsService.prototype) as object, {
      config: { get: (key: string) => env[key] },
      dispatchEmailPreferWhatsapp: dispatch,
    }) as unknown as InstanceType<typeof NotificationsService>;
    const sentText = () => (dispatch.mock.calls[0][1] as { text: string }).text;
    return { self, sentText };
  }
  const user = { email: 'a@example.com', phone: null };

  it.each<[Id, Record<string, string>, string | null]>([
    ['in', {}, 'https://admin.bhavano.com/requirements'],
    ['us', {}, null],
    ['us', { ADMIN_SITE_URL: 'https://admin-us.example.com' }, 'https://admin-us.example.com/requirements'],
  ])('the %s digest links to its own admin site (%j)', async (market, env, link) => {
    const { self, sentText } = notifications(market, env);
    await self.notifyRequirementDigest(user, ['2 bed in Austin'], 1);
    if (link) expect(sentText()).toContain(`Work them at ${link} `);
    else expect(sentText()).not.toContain('http');
  });

  it.each<[Id, boolean, string]>([
    ['in', false, '/premium'],
    ['in', true, '/my-requirements'],
    ['us', false, '/my-requirements'],
    ['us', true, '/my-requirements'],
  ])('the %s confirmation (alert: %s) links to %s', async (market, hasAlert, path) => {
    const { self, sentText } = notifications(market);
    await self.notifyRequirementCaptured(user, 'a 2 bed', hasAlert);
    expect(sentText()).toContain(`${path}`);
    if (path !== '/premium') expect(sentText()).not.toContain('/premium');
  });
});

describe('email copy', () => {
  const loader = (market: Id) => load<typeof import('../notifications/templateLoader')>(market, '../notifications/templateLoader').loadTemplate;
  const root = join(process.cwd(), 'notification-templates');
  const usFolders = readdirSync(join(root, 'us', 'email'));
  const wording = (t: object) => JSON.stringify(t);
  const placeholders = (t: object) => new Set(wording(t).match(/\{\{\w+\}\}/g) ?? []);

  it('has US copies of the emails that name India or offer something to buy', () => {
    expect(usFolders.sort()).toEqual(['claim-listing', 'listing-posted', 'listing-posted-reminder', 'requirement-captured-no-alert', 'welcome']);
  });

  it.each(usFolders)('the US %s names no India or paid feature, and uses only values the India one is given', (folder) => {
    expect(existsSync(join(root, 'email', folder))).toBe(true);
    const us = loader('us')(`email/${folder}`);
    expect(wording(us)).not.toMatch(/India|₹|WhatsApp|Featur|Boost|instant alert|plots|PG accommodation|brokerage|favourite/i);
    const india = placeholders(loader('in')(`email/${folder}`));
    for (const used of placeholders(us)) expect(india).toContain(used);
  });

  it('drops the WhatsApp share button from the US posted email and keeps it in India', () => {
    expect(loader('us')('email/listing-posted').secondaryButtonLabel).toBeUndefined();
    expect(loader('in')('email/listing-posted').secondaryButtonLabel).toBe('Share on WhatsApp');
  });

  it('uses India\'s copy in the US where there is no US one', () => {
    expect(loader('us')('email/new-message')).toEqual(loader('in')('email/new-message'));
  });

  it('India never reads a US copy', () => {
    expect(loader('in')('email/welcome').preheader).toContain('across India');
  });
});

describe('price check', () => {
  type Bounds = typeof import('../moderation/priceBounds');

  it('judges a posted price by the market the server serves', () => {
    expect(load<Bounds>('us', '../moderation/priceBounds').checkPriceSanity('apartment', 'rent', 950)).toBeNull();
    expect(load<Bounds>('in', '../moderation/priceBounds').checkPriceSanity('apartment', 'rent', 950)).toMatch(/₹950/);
  });
});

describe('questions the US must not ask', () => {
  type Service = typeof import('../listings/listings.service');
  const check = (market: Id, attributes: Record<string, unknown>) => {
    const { ListingsService } = load<Service>(market, '../listings/listings.service');
    const service = ListingsService.prototype as unknown as {
      assertValidAttributes: (category: string, transactionType: string, attributes: Record<string, unknown>) => void;
    };
    return () => service.assertValidAttributes.call(service, 'apartment', 'rent', attributes);
  };

  it('are refused by the US server even though its form does not list them', () => {
    expect(check('us', { vegetariansOnly: 'yes' })).toThrow('Vegetarians only is not applicable');
  });
});
