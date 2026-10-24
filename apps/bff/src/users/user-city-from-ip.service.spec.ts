import { mostFrequentPlace, UserCityFromIpService } from './user-city-from-ip.service';
import type { PrismaService } from '../prisma/prisma.service';

const BENGALURU = { id: 'c-blr', name: 'Bengaluru', isServed: true };
const CHENNAI = { id: 'c-maa', name: 'Chennai', isServed: true };

function make(opts: {
  visits?: { ipCity: string | null }[];
  alias?: { city: unknown } | null;
  cityByName?: unknown;
  users?: { id: string }[];
  updated?: number;
}) {
  const prisma = {
    visit: { findMany: jest.fn().mockResolvedValue(opts.visits ?? []) },
    localityAlias: { findFirst: jest.fn().mockResolvedValue(opts.alias ?? null) },
    city: { findFirst: jest.fn().mockResolvedValue(opts.cityByName ?? null) },
    user: {
      findMany: jest.fn().mockResolvedValueOnce(opts.users ?? []).mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: opts.updated ?? 1 }),
    },
  };
  return { prisma, service: new UserCityFromIpService(prisma as unknown as PrismaService) };
}

describe('mostFrequentPlace', () => {
  it('returns the commonest place, ignoring case and spaces', () => {
    expect(mostFrequentPlace(['Chennai', ' chennai', 'Bengaluru'])).toBe('Chennai');
  });

  it('breaks a tie in favour of the most recent (first in the list)', () => {
    expect(mostFrequentPlace(['Pune', 'Mumbai', 'Mumbai', 'Pune'])).toBe('Pune');
  });

  it('is null for nothing usable', () => {
    expect(mostFrequentPlace([])).toBeNull();
    expect(mostFrequentPlace([null, '', '  '])).toBeNull();
  });
});

describe('UserCityFromIpService.suggestFor', () => {
  it('asks only for Indian, located visits of that user', async () => {
    const { prisma, service } = make({ visits: [] });
    await service.suggestFor('u1');
    expect(prisma.visit.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1', ipCountry: 'IN', ipCity: { not: null } } }),
    );
  });

  it('maps an old name through an admin alias (Bangalore to Bengaluru)', async () => {
    const { service } = make({ visits: [{ ipCity: 'Bangalore' }], alias: { city: BENGALURU } });
    expect(await service.suggestFor('u1')).toBe(BENGALURU);
  });

  it('falls back to a served city of the same name', async () => {
    const { service } = make({ visits: [{ ipCity: 'Chennai' }], cityByName: CHENNAI });
    expect(await service.suggestFor('u1')).toBe(CHENNAI);
  });

  it('gives nothing for a place that is not a served city', async () => {
    const { service } = make({ visits: [{ ipCity: 'Smallville' }], alias: { city: { ...BENGALURU, isServed: false } } });
    expect(await service.suggestFor('u1')).toBeNull();
  });

  it('gives nothing when there are no located visits', async () => {
    const { service } = make({ visits: [] });
    expect(await service.suggestFor('u1')).toBeNull();
  });
});

describe('UserCityFromIpService.fillMissingCities', () => {
  it('fills only accounts older than a day with no city, marking the guess', async () => {
    const { prisma, service } = make({
      users: [{ id: 'u1' }],
      visits: [{ ipCity: 'Chennai' }],
      cityByName: CHENNAI,
    });
    const now = new Date('2026-10-24T10:00:00Z');

    const filled = await service.fillMissingCities(now);

    expect(filled).toBe(1);
    const where = (prisma.user.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.cityId).toBeNull();
    expect(where.createdAt.lte.toISOString()).toBe('2026-10-23T10:00:00.000Z');
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'u1', cityId: null },
      data: { cityId: 'c-maa', cityFromIp: true },
    });
  });

  it('skips an account with no usable guess and never writes for it', async () => {
    const { prisma, service } = make({ users: [{ id: 'u1' }], visits: [] });
    expect(await service.fillMissingCities()).toBe(0);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('counts nothing when the city was set in the meantime (conditional write)', async () => {
    const { service } = make({ users: [{ id: 'u1' }], visits: [{ ipCity: 'Chennai' }], cityByName: CHENNAI, updated: 0 });
    expect(await service.fillMissingCities()).toBe(0);
  });
});
