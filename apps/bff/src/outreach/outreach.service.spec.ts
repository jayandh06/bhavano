import { BadRequestException } from '@nestjs/common';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OutreachService, renderTemplate, guessGender, findLocalPhotos } from './outreach.service';
import { PrismaService } from '../prisma/prisma.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY_MS);

function makeService() {
  const prisma = {
    outreachContact: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    outreachCampaign: { findUnique: jest.fn(), update: jest.fn() },
    campaignSend: { groupBy: jest.fn().mockResolvedValue([]) },
    suppressionEntry: { findMany: jest.fn().mockResolvedValue([]) },
    listingNotificationLog: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn(),
  } as unknown as PrismaService;

  const config = { get: jest.fn() } as unknown as import('@nestjs/config').ConfigService;
  const msg91 = {
    sendListingVerificationRequest: jest.fn(),
  } as unknown as import('../notifications/providers/msg91.provider').Msg91Provider;
  const emailProvider = {
    send: jest.fn(),
  } as unknown as import('../notifications/providers/email.provider').EmailProvider;
  const listingsService = {
    create: jest.fn(),
  } as unknown as import('../listings/listings.service').ListingsService;
  const storage = {
    putObject: jest.fn(),
  } as unknown as import('../storage/r2-storage.service').R2StorageService;

  return {
    service: new OutreachService(prisma, config, msg91, emailProvider, listingsService, storage),
    prisma,
    config,
    msg91,
    emailProvider,
    listingsService,
    storage,
  };
}

function contact(overrides: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    name: 'Acme Realty',
    phoneE164: '+919876543210',
    email: null,
    consentState: 'none',
    lastContactedAt: null,
    status: 'new',
    businessCategory: 'real_estate_agency',
    ...overrides,
  };
}

const campaign = {
  audienceFilter: {},
  channel: 'sms' as const,
  minDaysBetweenSends: 14,
  maxSendsPerRun: 200,
};

describe('OutreachService.resolveEligible — who actually gets messaged', () => {
  it('includes a fresh, consenting, reachable contact', async () => {
    const { service, prisma } = makeService();
    (prisma.outreachContact.findMany as jest.Mock).mockResolvedValue([contact()]);

    const result = await service.resolveEligible(campaign);

    expect(result.contacts).toHaveLength(1);
    expect(result.audienceSize).toBe(1);
  });

  it('excludes an opted-out contact even when nothing is on the suppression list', async () => {
    const { service, prisma } = makeService();
    (prisma.outreachContact.findMany as jest.Mock).mockResolvedValue([
      contact({ consentState: 'opted_out' }),
    ]);

    const result = await service.resolveEligible(campaign);

    expect(result.contacts).toHaveLength(0);
    expect(result.suppressedCount).toBe(1);
  });

  it('excludes a contact whose number is on the suppression list, even if the row itself looks fine', async () => {
    // This is the re-import case: the contact row was recreated by a later scrape with a clean
    // consentState, but the suppression entry outlived it.
    const { service, prisma } = makeService();
    (prisma.outreachContact.findMany as jest.Mock).mockResolvedValue([contact()]);
    (prisma.suppressionEntry.findMany as jest.Mock).mockResolvedValue([{ value: '+919876543210' }]);

    const result = await service.resolveEligible(campaign);

    expect(result.contacts).toHaveLength(0);
    expect(result.suppressedCount).toBe(1);
  });

  it('excludes someone contacted inside the campaign cadence, and includes them once it has passed', async () => {
    const { service, prisma } = makeService();

    (prisma.outreachContact.findMany as jest.Mock).mockResolvedValue([
      contact({ lastContactedAt: daysAgo(3) }),
    ]);
    const recent = await service.resolveEligible(campaign);
    expect(recent.contacts).toHaveLength(0);
    expect(recent.recentlyContactedCount).toBe(1);

    (prisma.outreachContact.findMany as jest.Mock).mockResolvedValue([
      contact({ lastContactedAt: daysAgo(30) }),
    ]);
    const stale = await service.resolveEligible(campaign);
    expect(stale.contacts).toHaveLength(1);
  });

  it('skips contacts with no address for the campaign channel', async () => {
    const { service, prisma } = makeService();
    (prisma.outreachContact.findMany as jest.Mock).mockResolvedValue([
      contact({ phoneE164: null, email: 'a@b.com' }),
    ]);

    const sms = await service.resolveEligible({ ...campaign, channel: 'sms' });
    expect(sms.contacts).toHaveLength(0);

    const email = await service.resolveEligible({ ...campaign, channel: 'email' });
    expect(email.contacts).toHaveLength(1);
  });

  it('caps a run at maxSendsPerRun', async () => {
    const { service, prisma } = makeService();
    (prisma.outreachContact.findMany as jest.Mock).mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => contact({ id: `c${i}`, phoneE164: `+91987654321${i}` })),
    );

    const result = await service.resolveEligible({ ...campaign, maxSendsPerRun: 3 });

    expect(result.contacts).toHaveLength(3);
    expect(result.audienceSize).toBe(10);
  });
});

describe('OutreachService.updateCampaign — activation guards', () => {
  const existing = {
    id: 'k1',
    channel: 'sms',
    bodyTemplate: 'Hi {{name}}, list with Bhavano. Reply STOP to opt out.',
    dltTemplateId: 'DLT123',
  };

  function setup(overrides: Record<string, unknown> = {}) {
    const ctx = makeService();
    (ctx.prisma.outreachCampaign.findUnique as jest.Mock).mockResolvedValue({ ...existing, ...overrides });
    (ctx.prisma.outreachCampaign.update as jest.Mock).mockResolvedValue({
      ...existing,
      ...overrides,
      audienceFilter: {},
      createdAt: new Date(),
      scheduledAt: null,
      lastRunAt: null,
      subject: null,
      status: 'scheduled',
      maxSendsPerRun: 200,
      minDaysBetweenSends: 14,
      dryRun: true,
      name: 'k',
    });
    return ctx;
  }

  it('refuses to activate an SMS campaign without a DLT template', async () => {
    const { service } = setup({ dltTemplateId: null });
    await expect(service.updateCampaign('k1', { status: 'scheduled' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('refuses to activate a body with no opt-out instruction', async () => {
    const { service } = setup({ bodyTemplate: 'Hi {{name}}, list with Bhavano today!' });
    await expect(service.updateCampaign('k1', { status: 'scheduled' })).rejects.toThrow(/opt out/i);
  });

  it('allows a compliant campaign to activate', async () => {
    const { service } = setup();
    await expect(service.updateCampaign('k1', { status: 'scheduled' })).resolves.toBeDefined();
  });

  it('does not apply the guards to an ordinary draft edit', async () => {
    const { service } = setup({ dltTemplateId: null, bodyTemplate: 'no opt out here' });
    await expect(service.updateCampaign('k1', { name: 'renamed' })).resolves.toBeDefined();
  });
});

describe('renderTemplate', () => {
  it('substitutes known placeholders', () => {
    const out = renderTemplate('Hi {{name}} in {{city}} ({{category}})', contact() as never, 'Pune');
    expect(out).toBe('Hi Acme Realty in Pune (real_estate_agency)');
  });

  it('leaves an unknown placeholder visible rather than blanking it', () => {
    // A typo should be obvious in the preview, not silently produce a sentence missing a word.
    expect(renderTemplate('Hi {{frist_name}}', contact() as never, null)).toBe('Hi {{frist_name}}');
  });

  it('renders an empty string for a contact with no city', () => {
    expect(renderTemplate('Hi {{name}} in {{city}}', contact() as never, null)).toBe('Hi Acme Realty in ');
  });
});

describe('guessGender', () => {
  // Same cases already verified against export_outreach_contacts_for_listings.py's Python
  // version this mirrors — kept identical here so a future edit to either side that breaks
  // parity gets caught by whichever test suite runs.
  it.each([
    ['Sunrise Gents PG', ['men']],
    ['Green Boys Hostel', ['men']],
    ['Elite Ladies PG', ['women']],
    ['Happy Girls Hostel', ['women']],
    ['Metro Gents and Ladies PG', ['men', 'women']],
    ['Urban CoLiving Spaces', ['coed', 'men', 'women']],
    ['Downtown Co-Living PG', ['coed', 'men', 'women']],
    ['Cozy Co living Hub', ['coed', 'men', 'women']],
    ['Nova Colive PG', ['coed', 'men', 'women']],
    ["Women's Paradise PG", []], // "women" must not trip the men-keyword regex via substring
    ['Regular PG near station', []],
    ['Amenities PG', []], // must not match "men" inside "Amenities"
  ])('%s -> %j', (name, expected) => {
    expect(guessGender(name)).toEqual(expected);
  });
});

describe('findLocalPhotos', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'bhavano-photos-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('returns [] when there is no googlePlaceId at all', async () => {
    expect(await findLocalPhotos(dir, null)).toEqual([]);
  });

  it('returns [] when the directory does not exist rather than throwing', async () => {
    expect(await findLocalPhotos(join(dir, 'missing'), 'place1')).toEqual([]);
  });

  it('matches only this place\'s files, sorted, capped at 6, ignoring unrelated files', async () => {
    const names = [
      'place1_2.jpg',
      'place1_0.jpg',
      'place1_1.jpg',
      'place2_0.jpg', // a different place — must not be picked up
      'place1_readme.txt', // right prefix, wrong extension
      'place1_3.jpg',
      'place1_4.jpg',
      'place1_5.jpg',
      'place1_6.jpg', // 7th match for place1 — should be dropped by the cap
    ];
    await Promise.all(names.map((name) => writeFile(join(dir, name), 'x')));

    const found = await findLocalPhotos(dir, 'place1');
    expect(found).toEqual(
      ['place1_0.jpg', 'place1_1.jpg', 'place1_2.jpg', 'place1_3.jpg', 'place1_4.jpg', 'place1_5.jpg'].map((n) =>
        join(dir, n),
      ),
    );
  });
});

describe('OutreachService.sendClaimVerification — ListingNotificationLog write', () => {
  function setup(overrides: {
    emailSent?: boolean;
    whatsappSent?: boolean;
    whatsappMessageId?: string | null;
  } = {}) {
    const { service, prisma, config, msg91, emailProvider } = makeService();
    (config.get as jest.Mock).mockImplementation((key: string) =>
      key === 'MSG91_MARKETING_ENABLED' ? 'true' : key === 'PUBLIC_SITE_URL' ? 'https://bhavano.com' : undefined,
    );
    (prisma.outreachContact.findUnique as jest.Mock).mockResolvedValue(
      contact({
        email: 'owner@example.com',
        phoneE164: '+919876543210',
        city: { name: 'Bengaluru' },
        area: { name: 'Koramangala' },
        claimedListing: { id: 'listing1', claimedAt: null },
      }),
    );
    (emailProvider.send as jest.Mock).mockResolvedValue(overrides.emailSent ?? true);
    (msg91.sendListingVerificationRequest as jest.Mock).mockResolvedValue({
      sent: overrides.whatsappSent ?? true,
      messageId: 'whatsappMessageId' in overrides ? overrides.whatsappMessageId : 'msg-123',
    });
    return { service, prisma };
  }

  it('logs one row per channel, both successful', async () => {
    const { service, prisma } = setup();
    const result = await service.sendClaimVerification('c1');
    expect(result).toEqual({ sent: true, channels: ['email', 'whatsapp'] });

    const calls = (prisma.listingNotificationLog.create as jest.Mock).mock.calls.map((c) => c[0].data);
    expect(calls).toContainEqual(
      expect.objectContaining({
        listingId: 'listing1',
        kind: 'claim_verification',
        channel: 'email',
        providerMessageId: null,
        deliveryStatus: null,
        deliveryStatusAt: null,
      }),
    );
    expect(calls).toContainEqual(
      expect.objectContaining({
        listingId: 'listing1',
        kind: 'claim_verification',
        channel: 'whatsapp',
        providerMessageId: 'msg-123',
        deliveryStatus: null,
        deliveryStatusAt: null,
      }),
    );
  });

  it('marks a failed WhatsApp attempt as failed immediately, with no message id to correlate', async () => {
    const { service, prisma } = setup({ whatsappSent: false, whatsappMessageId: null });
    await service.sendClaimVerification('c1');

    const whatsappCall = (prisma.listingNotificationLog.create as jest.Mock).mock.calls
      .map((c) => c[0].data)
      .find((d) => d.channel === 'whatsapp');
    expect(whatsappCall).toMatchObject({ providerMessageId: null, deliveryStatus: 'failed' });
    expect(whatsappCall.deliveryStatusAt).toBeInstanceOf(Date);
  });

  it('marks a failed email attempt as failed too, distinguishable from a silent one', async () => {
    const { service, prisma } = setup({ emailSent: false });
    await service.sendClaimVerification('c1');

    const emailCall = (prisma.listingNotificationLog.create as jest.Mock).mock.calls
      .map((c) => c[0].data)
      .find((d) => d.channel === 'email');
    expect(emailCall).toMatchObject({ deliveryStatus: 'failed' });
  });
});

describe('OutreachService.listClaimVerificationSends', () => {
  it('returns [] for a contact with no linked listing at all', async () => {
    const { service, prisma } = makeService();
    (prisma.outreachContact.findUnique as jest.Mock).mockResolvedValue({ claimedListing: null });
    await expect(service.listClaimVerificationSends('c1')).resolves.toEqual([]);
    expect(prisma.listingNotificationLog.findMany).not.toHaveBeenCalled();
  });

  it('maps rows for a contact that does have one', async () => {
    const { service, prisma } = makeService();
    (prisma.outreachContact.findUnique as jest.Mock).mockResolvedValue({ claimedListing: { id: 'listing1' } });
    (prisma.listingNotificationLog.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'log1',
        channel: 'whatsapp',
        sentAt: new Date('2026-09-01T00:00:00Z'),
        providerMessageId: 'msg-123',
        deliveryStatus: 'delivered',
        deliveryStatusAt: new Date('2026-09-01T00:05:00Z'),
      },
    ]);
    await expect(service.listClaimVerificationSends('c1')).resolves.toEqual([
      {
        id: 'log1',
        channel: 'whatsapp',
        sentAt: '2026-09-01T00:00:00.000Z',
        providerMessageId: 'msg-123',
        deliveryStatus: 'delivered',
        deliveryStatusAt: '2026-09-01T00:05:00.000Z',
      },
    ]);
    expect(prisma.listingNotificationLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { listingId: 'listing1', kind: 'claim_verification' } }),
    );
  });
});

describe('OutreachService.createListingFromContact — the businessStatus gate', () => {
  it('refuses a business Google reports as permanently closed', async () => {
    const { service, prisma } = makeService();
    (prisma.outreachContact.findUnique as jest.Mock).mockResolvedValue(
      contact({ businessCategory: 'pg', cityId: 'city1', claimedListing: null, businessStatus: 'CLOSED_PERMANENTLY' }),
    );
    await expect(service.createListingFromContact('c1')).rejects.toThrow(/CLOSED_PERMANENTLY/);
  });

  it('refuses a business Google reports as temporarily closed', async () => {
    const { service, prisma } = makeService();
    (prisma.outreachContact.findUnique as jest.Mock).mockResolvedValue(
      contact({ businessCategory: 'pg', cityId: 'city1', claimedListing: null, businessStatus: 'CLOSED_TEMPORARILY' }),
    );
    await expect(service.createListingFromContact('c1')).rejects.toThrow(/CLOSED_TEMPORARILY/);
  });

  it('does not block on a null businessStatus (unknown, not known-closed)', async () => {
    const { service, prisma, config } = makeService();
    (prisma.outreachContact.findUnique as jest.Mock).mockResolvedValue(
      contact({ businessCategory: 'pg', cityId: 'city1', claimedListing: null, businessStatus: null }),
    );
    (config.get as jest.Mock).mockReturnValue(undefined); // SCRAPED_PHOTOS_DIR unset
    // Gets past the businessStatus gate and fails at the next real check instead (not configured)
    // — proves null didn't trip the same refusal as an actual CLOSED_* status would.
    await expect(service.createListingFromContact('c1')).rejects.toThrow(/SCRAPED_PHOTOS_DIR/);
  });

  it('does not block an operational business either', async () => {
    const { service, prisma, config } = makeService();
    (prisma.outreachContact.findUnique as jest.Mock).mockResolvedValue(
      contact({ businessCategory: 'pg', cityId: 'city1', claimedListing: null, businessStatus: 'OPERATIONAL' }),
    );
    (config.get as jest.Mock).mockReturnValue(undefined);
    await expect(service.createListingFromContact('c1')).rejects.toThrow(/SCRAPED_PHOTOS_DIR/);
  });
});
