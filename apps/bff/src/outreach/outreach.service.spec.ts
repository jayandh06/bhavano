import { BadRequestException } from '@nestjs/common';
import { OutreachService, renderTemplate } from './outreach.service';
import { PrismaService } from '../prisma/prisma.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY_MS);

function makeService() {
  const prisma = {
    outreachContact: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    outreachCampaign: { findUnique: jest.fn(), update: jest.fn() },
    campaignSend: { groupBy: jest.fn().mockResolvedValue([]) },
    suppressionEntry: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn(),
  } as unknown as PrismaService;

  return { service: new OutreachService(prisma), prisma };
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
