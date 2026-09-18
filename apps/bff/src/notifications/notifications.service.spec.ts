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
  const sendTemplate = jest.fn().mockResolvedValue(true);

  const service = new NotificationsService(
    { send: emailSend } as unknown as EmailProvider,
    { sendTemplate } as unknown as WhatsappProvider,
    { sendBoostPromotion } as unknown as Msg91Provider,
    { get: jest.fn().mockReturnValue('https://www.bhavano.com') } as unknown as ConfigService,
  );
  return { service, emailSend, sendBoostPromotion, sendTemplate };
}

const LISTING = { id: 'abc123', title: '2 BHK for rent in Koramangala', cityName: 'Bengaluru', area: 'Koramangala' };
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
      { name: 'Ravi', title: LISTING.title, boostPrice: '100', bundlePrice: '112' },
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
      await failing.service.notifyBoostPromotion({ name: 'Ravi', email: null, phone: '9876543210' }, LISTING, PRICES),
    ).toEqual([]);
  });

  it('still records the email when only the WhatsApp half fails', async () => {
    const { service, sendBoostPromotion } = make();
    (sendBoostPromotion as jest.Mock).mockResolvedValueOnce({ sent: false, messageId: null });

    const channels = await service.notifyBoostPromotion(
      { name: 'Ravi', email: 'ravi@example.com', phone: '9876543210' },
      LISTING,
      PRICES,
    );

    // A failed template send must not lose the email that did go out — the admin summary and the
    // notification log both read this list.
    expect(channels).toEqual([{ channel: 'email' }]);
  });
});
