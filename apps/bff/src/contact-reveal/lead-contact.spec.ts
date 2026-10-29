import { buildLeadContactView, leadPhoneIfShareable, ownerSeesLeadsFree, unlockLeadContact, type LeadSeeker } from './lead-contact';
import { InsufficientContactRevealCreditsException } from './contact-reveal.service';
import { BULK_IMPORT_OWNER_PHONE } from '../listings/bulk-import-owner';

const NOW = new Date('2026-10-29T10:00:00Z').getTime();
const DAY = 24 * 60 * 60 * 1000;
const on = { enabled: true, consentMode: 'notice' as const, freeLeadRevealsPerOwner: 0 };
const seeker = (o: Partial<LeadSeeker> = {}): LeadSeeker => ({
  phone: '+919876543210',
  phoneVerifiedAt: new Date('2026-10-01'),
  role: 'user',
  contactShareChoice: 'unset',
  ...o,
});
const recent = new Date(NOW - 2 * DAY);

describe('leadPhoneIfShareable', () => {
  it('shares a verified phone in notice mode unless the seeker said no', () => {
    expect(leadPhoneIfShareable(on, seeker(), recent, NOW)).toBe('+919876543210');
    expect(leadPhoneIfShareable(on, seeker({ contactShareChoice: 'yes' }), recent, NOW)).toBe('+919876543210');
    expect(leadPhoneIfShareable(on, seeker({ contactShareChoice: 'no' }), recent, NOW)).toBeNull();
  });

  it('shares only what the seeker agreed to in opt-in mode', () => {
    const optIn = { ...on, consentMode: 'opt_in' as const };
    expect(leadPhoneIfShareable(optIn, seeker(), recent, NOW)).toBeNull();
    expect(leadPhoneIfShareable(optIn, seeker({ contactShareChoice: 'yes' }), recent, NOW)).toBe('+919876543210');
  });

  it('never shares when the feature is off, for admins, the import placeholder, unverified phones or old interests', () => {
    expect(leadPhoneIfShareable({ ...on, enabled: false }, seeker(), recent, NOW)).toBeNull();
    expect(leadPhoneIfShareable(on, seeker({ role: 'admin' }), recent, NOW)).toBeNull();
    expect(leadPhoneIfShareable(on, seeker({ phone: BULK_IMPORT_OWNER_PHONE }), recent, NOW)).toBeNull();
    expect(leadPhoneIfShareable(on, seeker({ phoneVerifiedAt: null }), recent, NOW)).toBeNull();
    expect(leadPhoneIfShareable(on, seeker({ phone: null }), recent, NOW)).toBeNull();
    expect(leadPhoneIfShareable(on, seeker(), new Date(NOW - 31 * DAY), NOW)).toBeNull();
  });
});

describe('ownerSeesLeadsFree', () => {
  it('is true for an active Featured ad or active Agent Pro only', () => {
    expect(ownerSeesLeadsFree({ boostedUntil: new Date(NOW + DAY) }, { agentProUntil: null }, NOW)).toBe(true);
    expect(ownerSeesLeadsFree({ boostedUntil: null }, { agentProUntil: new Date(NOW + DAY) }, NOW)).toBe(true);
    expect(ownerSeesLeadsFree({ boostedUntil: new Date(NOW - DAY) }, { agentProUntil: new Date(NOW - DAY) }, NOW)).toBe(false);
  });
});

function prismaFor(opts: {
  settings?: Record<string, unknown> | null;
  boostedUntil?: Date | null;
  agentProUntil?: Date | null;
  revealed?: string[];
  freeUsed?: number;
  credits?: number;
  ownerId?: string;
  interest?: { lastSeenAt: Date; user: LeadSeeker } | null;
}) {
  const created: unknown[] = [];
  const decrement = jest.fn();
  const tx = {
    leadContactReveal: {
      findUnique: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(opts.freeUsed ?? 0),
      create: jest.fn((a: unknown) => {
        created.push(a);
        return Promise.resolve({});
      }),
    },
    seekerContactSetting: { findUnique: jest.fn().mockResolvedValue(opts.settings === undefined ? { ...on } : opts.settings) },
    contactRevealCreditBatch: {
      findFirst: jest.fn().mockResolvedValue((opts.credits ?? 0) > 0 ? { id: 'b1' } : null),
      update: decrement,
    },
  };
  const prisma = {
    seekerContactSetting: tx.seekerContactSetting,
    contactRevealSetting: { findUnique: jest.fn().mockResolvedValue(null) },
    user: { findUnique: jest.fn().mockResolvedValue({ agentProUntil: opts.agentProUntil ?? null }) },
    listing: {
      findUnique: jest.fn().mockResolvedValue({
        ownerId: opts.ownerId ?? 'owner',
        boostedUntil: opts.boostedUntil ?? null,
        owner: { agentProUntil: opts.agentProUntil ?? null },
      }),
    },
    listingInterest: {
      findUnique: jest.fn().mockResolvedValue(opts.interest === undefined ? { lastSeenAt: new Date(), user: seeker() } : opts.interest),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    leadContactReveal: {
      findMany: jest.fn().mockResolvedValue((opts.revealed ?? []).map((seekerId) => ({ seekerId }))),
      count: tx.leadContactReveal.count,
    },
    contactRevealCreditBatch: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { creditsRemaining: opts.credits ?? 0 } }),
      findFirst: tx.contactRevealCreditBatch.findFirst,
    },
    $transaction: jest.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  return { prisma: prisma as never, created, decrement, tx };
}

describe('buildLeadContactView', () => {
  const interests = [
    { userId: 'a', lastSeenAt: new Date(), user: seeker() },
    { userId: 'b', lastSeenAt: new Date(), user: seeker({ contactShareChoice: 'no' }) },
    { userId: 'c', lastSeenAt: new Date(), user: seeker({ phone: null, phoneVerifiedAt: null }) },
  ];

  it('is Message-only everywhere while the feature is off', async () => {
    const { prisma } = prismaFor({ settings: null });
    const view = await buildLeadContactView(prisma, { listingId: 'l', ownerId: 'owner', listing: { boostedUntil: new Date(Date.now() + DAY) }, interests });
    expect(view.summary.enabled).toBe(false);
    expect([...view.byUser.values()].every((v) => v.contact === 'none' && v.phone === null && v.phoneMasked === null)).toBe(true);
  });

  it('shows the number on a Featured ad, only for a shareable seeker', async () => {
    const { prisma } = prismaFor({});
    const view = await buildLeadContactView(prisma, { listingId: 'l', ownerId: 'owner', listing: { boostedUntil: new Date(Date.now() + DAY) }, interests });
    expect(view.byUser.get('a')).toEqual({ contact: 'available', phone: '+919876543210', phoneMasked: null });
    expect(view.byUser.get('b')?.contact).toBe('none');
    expect(view.byUser.get('c')?.contact).toBe('none');
  });

  it('masks the number on a free ad until it is unlocked, and never leaks it in the mask', async () => {
    const { prisma } = prismaFor({ revealed: [] });
    const view = await buildLeadContactView(prisma, { listingId: 'l', ownerId: 'owner', listing: { boostedUntil: null }, interests });
    const a = view.byUser.get('a');
    expect(a?.contact).toBe('unlockable');
    expect(a?.phone).toBeNull();
    expect(a?.phoneMasked).toBe('+91 98••••••10');

    const unlocked = await buildLeadContactView(prismaFor({ revealed: ['a'] }).prisma, { listingId: 'l', ownerId: 'owner', listing: { boostedUntil: null }, interests });
    expect(unlocked.byUser.get('a')).toEqual({ contact: 'available', phone: '+919876543210', phoneMasked: null });
  });

  it('a seeker who later says no is hidden even if the owner had unlocked them', async () => {
    const { prisma } = prismaFor({ revealed: ['b'] });
    const view = await buildLeadContactView(prisma, { listingId: 'l', ownerId: 'owner', listing: { boostedUntil: null }, interests });
    expect(view.byUser.get('b')?.contact).toBe('none');
  });
});

describe('unlockLeadContact', () => {
  it('is free on a Featured ad: no credit spent, no reveal row', async () => {
    const { prisma, created, decrement } = prismaFor({ boostedUntil: new Date(Date.now() + DAY) });
    await expect(unlockLeadContact(prisma, 'owner', 'l', 'a')).resolves.toEqual({ phone: '+919876543210' });
    expect(created).toHaveLength(0);
    expect(decrement).not.toHaveBeenCalled();
  });

  it('spends one credit on a free ad and records the unlock', async () => {
    const { prisma, created, decrement } = prismaFor({ credits: 3 });
    await expect(unlockLeadContact(prisma, 'owner', 'l', 'a')).resolves.toEqual({ phone: '+919876543210' });
    expect(decrement).toHaveBeenCalledWith({ where: { id: 'b1' }, data: { creditsRemaining: { decrement: 1 } } });
    expect(created).toHaveLength(1);
  });

  it('uses a free lead unlock first when the admin granted some', async () => {
    const { prisma, created, decrement } = prismaFor({ settings: { ...on, freeLeadRevealsPerOwner: 1 }, freeUsed: 0, credits: 0 });
    await unlockLeadContact(prisma, 'owner', 'l', 'a');
    expect(decrement).not.toHaveBeenCalled();
    expect(created[0]).toMatchObject({ data: { source: 'free' } });
  });

  it('answers 402 when there is no credit, and charges nothing', async () => {
    const { prisma, created } = prismaFor({ credits: 0 });
    await expect(unlockLeadContact(prisma, 'owner', 'l', 'a')).rejects.toBeInstanceOf(InsufficientContactRevealCreditsException);
    expect(created).toHaveLength(0);
  });

  it('refuses without charging when the number cannot be shown', async () => {
    const { prisma, decrement } = prismaFor({ credits: 3, interest: { lastSeenAt: new Date(), user: seeker({ contactShareChoice: 'no' }) } });
    await expect(unlockLeadContact(prisma, 'owner', 'l', 'a')).rejects.toMatchObject({ response: { code: 'LEAD_CONTACT_UNAVAILABLE' } });
    expect(decrement).not.toHaveBeenCalled();
  });

  it('refuses a caller who does not own the ad, and does nothing while the feature is off', async () => {
    await expect(unlockLeadContact(prismaFor({ ownerId: 'someone-else' }).prisma, 'owner', 'l', 'a')).rejects.toThrow('Not your listing');
    await expect(unlockLeadContact(prismaFor({ settings: null }).prisma, 'owner', 'l', 'a')).rejects.toThrow('Not available');
  });
});
