import { NotificationsService } from './notifications.service';
import type { ConfigService } from '@nestjs/config';
import type { EmailProvider } from './providers/email.provider';
import type { WhatsappProvider } from './providers/whatsapp.provider';
import type { Msg91Provider } from './providers/msg91.provider';

/**
 * Which channel the Boost promotion goes out on, and what the WhatsApp half is handed.
 *
 * The rule worth pinning is that WhatsApp here goes through MSG91's `ad_boost_instant_alert` and
 * not the Meta-direct provider every other fallback in this file uses — that template has two
 * dynamic URL buttons and `WhatsappProvider.sendTemplate` speaks only one, so picking the wrong
 * provider would silently drop the second button.
 */
function make() {
  const emailSend = jest.fn().mockResolvedValue(true);
  const sendBoostPromotion = jest.fn().mockResolvedValue({ sent: true, messageId: 'req-1' });
  const sendAdPostedConfirmation = jest.fn().mockResolvedValue({ sent: true, messageId: 'req-2' });
  const sendTemplate = jest.fn().mockResolvedValue(true);

  const service = new NotificationsService(
    { send: emailSend } as unknown as EmailProvider,
    { sendTemplate } as unknown as WhatsappProvider,
    { sendBoostPromotion, sendAdPostedConfirmation } as unknown as Msg91Provider,
    { get: jest.fn().mockReturnValue('https://www.bhavano.com') } as unknown as ConfigService,
  );
  return { service, emailSend, sendBoostPromotion, sendAdPostedConfirmation, sendTemplate };
}

const LISTING = {
  id: 'abc123',
  slug: '2-bhk-for-rent-in-koramangala',
  category: 'apartment',
  transactionType: 'rent',
  title: '2 BHK for rent in Koramangala',
  cityName: 'Bengaluru',
  area: 'Koramangala',
} as const;
const PRICES = { boostPrice: 100, bundlePrice: 112, boostDays: 7, alertsPrice: 25 };
const OFFER = { discountPercent: 50, boostBasePrice: 199, bundleBasePrice: 224, endsOn: '30 September' };

describe('NotificationsService.notifyBoostPromotion', () => {
  it('sends on BOTH channels when the owner has an email and a phone', async () => {
    const { service, emailSend, sendBoostPromotion } = make();

    const channels = await service.notifyBoostPromotion(
      { name: 'Ravi', email: 'ravi@example.com', phone: '9876543210' },
      LISTING,
      { ...PRICES, offer: OFFER },
    );

    // An offer, not a receipt: an owner who reads only one of the two would otherwise never see
    // it. Every other notification in the service stays email-else-WhatsApp.
    expect(channels).toEqual([{ channel: 'email' }, { channel: 'whatsapp', messageId: 'req-1' }]);
    expect(sendBoostPromotion).toHaveBeenCalledTimes(1);
    const [, subject, text] = emailSend.mock.calls[0];
    expect(subject).toContain('50% off');
    // Both destinations reach the plain-text part, which is the only place a URL belongs.
    expect(text).toContain('my-listings?openBoost=abc123');
    expect(text).toContain('withAlerts=1');
  });

  it('skips WhatsApp entirely with no offer running, since the template names an end date', async () => {
    const { service, sendBoostPromotion, emailSend } = make();

    const channels = await service.notifyBoostPromotion(
      { name: 'Ravi', email: 'ravi@example.com', phone: '9876543210' },
      LISTING,
      PRICES,
    );

    // An empty body parameter is an error from MSG91, not a gap in a sentence — so the email goes
    // (it has a no-offer wording of its own) and WhatsApp waits for the next offer.
    expect(sendBoostPromotion).not.toHaveBeenCalled();
    expect(emailSend).toHaveBeenCalled();
    expect(channels).toEqual([{ channel: 'email' }]);
  });

  it('sends the offer wording only while a promo is live', async () => {
    const { service, emailSend } = make();

    await service.notifyBoostPromotion({ name: 'Ravi', email: 'ravi@example.com', phone: null }, LISTING, PRICES);

    expect(emailSend.mock.calls[0][1]).not.toContain('% off');
  });

  it('falls back to MSG91 for a phone-only owner, with both button suffixes', async () => {
    const { service, sendBoostPromotion, sendTemplate } = make();

    const channels = await service.notifyBoostPromotion(
      { name: 'Ravi', email: null, phone: '9876543210' },
      LISTING,
      { ...PRICES, offer: OFFER },
    );

    // The MSG91 id comes back with it, so the log row can carry it for delivery webhooks.
    expect(channels).toEqual([{ channel: 'whatsapp', messageId: 'req-1' }]);
    // Not the Meta-direct provider — see this file's own note on why.
    expect(sendTemplate).not.toHaveBeenCalled();
    expect(sendBoostPromotion).toHaveBeenCalledWith(
      '9876543210',
      // Slots 3 and 4 are the locality and the offer's end date — the approved copy's order, and
      // the thing the first version got wrong by sending prices.
      { name: 'Ravi', title: LISTING.title, location: 'Koramangala, Bengaluru', offerEnds: '30 September' },
      // Whole path: ad_boost_instant_alert_1 was recreated with a base that resolves these
      // directly, so the message's link is /my-listings?openBoost=<id> with no redirect hop.
      {
        boostSuffix: 'my-listings?openBoost=abc123',
        bundleSuffix: 'my-listings?openBoost=abc123&withAlerts=1',
      },
    );
  });

  it('reports nothing sent when the owner has neither, and when MSG91 skips', async () => {
    const { service } = make();
    expect(await service.notifyBoostPromotion({ name: null, email: null, phone: null }, LISTING, PRICES)).toEqual([]);

    const failing = make();
    (failing.sendBoostPromotion as jest.Mock).mockResolvedValueOnce({ sent: false, messageId: null });
    expect(
      await failing.service.notifyBoostPromotion({ name: 'Ravi', email: null, phone: '9876543210' }, LISTING, {
        ...PRICES,
        offer: OFFER,
      }),
    ).toEqual([]);
  });

  it('still records the email when only the WhatsApp half fails', async () => {
    const { service, sendBoostPromotion } = make();
    (sendBoostPromotion as jest.Mock).mockResolvedValueOnce({ sent: false, messageId: null });

    const channels = await service.notifyBoostPromotion(
      { name: 'Ravi', email: 'ravi@example.com', phone: '9876543210' },
      LISTING,
      { ...PRICES, offer: OFFER },
    );

    // A failed template send must not lose the email that did go out — the admin summary and the
    // notification log both read this list.
    expect(channels).toEqual([{ channel: 'email' }]);
  });
});

/**
 * support@bhavano.com is meant to see a copy of every welcome/listing-posted send regardless of
 * which channel the owner actually got it on — previously the BCC only ever attached to the
 * email branch, so a phone-only owner (WhatsApp instead) meant support saw nothing at all.
 */
describe('NotificationsService — support@ visibility on the WhatsApp branch', () => {
  it('notifyWelcome emails support@ directly when the owner is WhatsApp-only', async () => {
    const { service, emailSend, sendTemplate } = make();

    const channel = await service.notifyWelcome({ name: 'Ravi', email: null, phone: '9876543210' });

    expect(channel).toBe('whatsapp');
    expect(sendTemplate).toHaveBeenCalledTimes(1);
    // The owner never gets an email here (no address on file) — this call is entirely the
    // internal visibility copy, sent straight to support@ since there's no BCC header to
    // piggyback on.
    expect(emailSend).toHaveBeenCalledTimes(1);
    const [supportTo] = emailSend.mock.calls[0];
    expect(supportTo).toBe('support@bhavano.com');
  });

  it('notifyWelcome does not email support@ twice when the owner has an email (BCC covers it)', async () => {
    const { service, emailSend, sendTemplate } = make();

    const channel = await service.notifyWelcome({ name: 'Ravi', email: 'ravi@example.com', phone: '9876543210' });

    expect(channel).toBe('email');
    expect(sendTemplate).not.toHaveBeenCalled();
    expect(emailSend).toHaveBeenCalledTimes(1);
    const [ownerTo, , , ownerOptions] = emailSend.mock.calls[0];
    expect(ownerTo).toBe('ravi@example.com');
    expect(ownerOptions).toMatchObject({ bcc: 'support@bhavano.com' });
  });

  it('notifyListingPosted emails support@ directly when the owner is WhatsApp-only', async () => {
    const { service, emailSend, sendAdPostedConfirmation } = make();

    const result = await service.notifyListingPosted(
      { name: 'Ravi', email: null, phone: '9876543210' },
      LISTING,
    );

    expect(result).toEqual({ channel: 'whatsapp', messageId: 'req-2' });
    expect(sendAdPostedConfirmation).toHaveBeenCalledTimes(1);
    expect(emailSend).toHaveBeenCalledTimes(1);
    const [to, , , options] = emailSend.mock.calls[0];
    expect(to).toBe('support@bhavano.com');
    expect(options).not.toHaveProperty('bcc');
  });

  it('notifyListingPosted skips the support@ copy when the WhatsApp send itself fails', async () => {
    const { service, emailSend, sendAdPostedConfirmation } = make();
    (sendAdPostedConfirmation as jest.Mock).mockResolvedValueOnce({ sent: false, messageId: null });

    const result = await service.notifyListingPosted(
      { name: 'Ravi', email: null, phone: '9876543210' },
      LISTING,
    );

    expect(result).toBeNull();
    expect(emailSend).not.toHaveBeenCalled();
  });
});
