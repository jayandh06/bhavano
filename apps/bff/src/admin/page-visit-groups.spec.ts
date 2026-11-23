import type { PageVisitDto, PageVisitHighlights } from '@bhavano/types';
import { groupVisitsByUser, groupVisitsByUserDay, istDay, mergeHighlights, mergeVisitGroup } from './page-visit-groups';

function visit(over: Partial<PageVisitDto> = {}): PageVisitDto {
  return {
    id: 'v1',
    sessionId: 's1',
    createdAt: '2026-11-01T05:00:00.000Z',
    lastActivityAt: '2026-11-01T05:10:00.000Z',
    userId: 'u1',
    userName: 'A',
    userPhone: null,
    userEmail: null,
    userDeleted: false,
    source: 'direct',
    medium: null,
    campaign: null,
    landingPath: '/',
    ip: '1.1.1.1',
    ipCity: null,
    ipRegion: null,
    ipCountry: null,
    deviceType: 'mobile_app',
    os: null,
    jsConfirmedAt: null,
    pageViewCount: 3,
    sessionLogins: [],
    ...over,
  };
}

const quiet: PageVisitHighlights = { ad: null, featured: null, requirement: null, purchased: false, activePurchase: false };

describe('groupVisitsByUser', () => {
  it("puts one account's sessions together and leaves visits nobody logged in on alone", () => {
    const groups = groupVisitsByUser([
      { id: 'a', userId: 'u1' },
      { id: 'b', userId: null },
      { id: 'c', userId: 'u2' },
      { id: 'd', userId: 'u1' },
      { id: 'e', userId: null },
    ]);
    expect(groups.map((g) => g.ids)).toEqual([['a', 'd'], ['b'], ['c'], ['e']]);
  });

  it('keeps groups in the order their newest visit appears', () => {
    const groups = groupVisitsByUser([
      { id: 'a', userId: 'u2' },
      { id: 'b', userId: 'u1' },
      { id: 'c', userId: 'u2' },
    ]);
    expect(groups.map((g) => g.key)).toEqual(['u2', 'u1']);
  });
});

describe('mergeHighlights', () => {
  it('takes the strongest of each, and any purchase flag', () => {
    const merged = mergeHighlights([
      { ...quiet, ad: 'pipeline', featured: 'past' },
      { ...quiet, ad: 'live', purchased: true },
      { ...quiet, featured: 'active', activePurchase: true },
    ]);
    expect(merged).toEqual({ ad: 'live', featured: 'active', requirement: null, purchased: true, activePurchase: true });
  });

  it('is undefined when no session had any', () => {
    expect(mergeHighlights([undefined, undefined])).toBeUndefined();
  });
});

describe('mergeVisitGroup', () => {
  const early = visit({ id: 'v1', sessionId: 's1', createdAt: '2026-11-01T05:00:00.000Z', lastActivityAt: '2026-11-01T05:20:00.000Z', pageViewCount: 38, highlights: { ...quiet, ad: 'live', featured: 'active', purchased: true, activePurchase: true } });
  const late = visit({ id: 'v2', sessionId: 's2', createdAt: '2026-11-01T05:56:00.000Z', lastActivityAt: '2026-11-01T06:10:00.000Z', pageViewCount: 13, source: 'google', highlights: { ...quiet, purchased: true, activePurchase: true } });

  it('returns a lone session untouched', () => {
    expect(mergeVisitGroup([early])).toBe(early);
  });

  it('keeps how the person arrived, spans the sessions and adds up the page views', () => {
    const merged = mergeVisitGroup([late, early]);
    expect(merged.sessionId).toBe('s1');
    expect(merged.source).toBe('direct');
    expect(merged.createdAt).toBe(early.createdAt);
    expect(merged.lastActivityAt).toBe(late.lastActivityAt);
    expect(merged.pageViewCount).toBe(51);
    expect(merged.groupedSessionIds).toEqual(['s1', 's2']);
    expect(merged.highlights).toEqual({ ad: 'live', featured: 'active', requirement: null, purchased: true, activePurchase: true });
  });

  it('lists each account that logged in once', () => {
    const login = { userId: 'u1', name: 'A', phone: null, email: null, deleted: false, method: 'google' as const, createdAt: '2026-11-01T05:00:00.000Z' };
    const merged = mergeVisitGroup([{ ...early, sessionLogins: [login] }, { ...late, sessionLogins: [login] }]);
    expect(merged.sessionLogins).toHaveLength(1);
  });
});

describe('istDay', () => {
  it('uses the Indian calendar day, not UTC', () => {
    // 2026-11-22 20:00 UTC is already 01:30 on the 23rd in India.
    expect(istDay(new Date('2026-11-22T20:00:00Z'))).toBe('2026-11-23');
    expect(istDay(new Date('2026-11-22T18:29:59Z'))).toBe('2026-11-22');
    expect(istDay(new Date('2026-11-22T18:30:00Z'))).toBe('2026-11-23');
  });
});

describe('groupVisitsByUserDay', () => {
  const at = (iso: string) => new Date(iso);

  it("merges one user's sessions on the same IST day, even across the UTC date change", () => {
    // The 2026-11-23 report: four app launches between 23:58 and 00:26 UTC, all the morning of 23 Nov in India.
    const groups = groupVisitsByUserDay([
      { id: 'a', userId: 'u1', createdAt: at('2026-11-23T00:15:21Z') },
      { id: 'b', userId: 'u1', createdAt: at('2026-11-23T00:12:20Z') },
      { id: 'c', userId: 'u1', createdAt: at('2026-11-23T00:11:53Z') },
      { id: 'd', userId: 'u1', createdAt: at('2026-11-22T23:58:10Z') },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].ids).toEqual(['a', 'b', 'c', 'd']);
  });

  it("keeps one user's sessions on different IST days as different rows", () => {
    const groups = groupVisitsByUserDay([
      { id: 'a', userId: 'u1', createdAt: at('2026-11-23T06:00:00Z') },
      { id: 'b', userId: 'u1', createdAt: at('2026-11-21T06:00:00Z') },
    ]);
    expect(groups.map((g) => g.ids)).toEqual([['a'], ['b']]);
  });

  it('keeps different users apart on the same day', () => {
    const groups = groupVisitsByUserDay([
      { id: 'a', userId: 'u1', createdAt: at('2026-11-23T06:00:00Z') },
      { id: 'b', userId: 'u2', createdAt: at('2026-11-23T06:05:00Z') },
    ]);
    expect(groups).toHaveLength(2);
  });

  it('never merges visits nobody logged in on', () => {
    const groups = groupVisitsByUserDay([
      { id: 'a', userId: null, createdAt: at('2026-11-23T06:00:00Z') },
      { id: 'b', userId: null, createdAt: at('2026-11-23T06:01:00Z') },
    ]);
    expect(groups.map((g) => g.ids)).toEqual([['a'], ['b']]);
  });

  it('keeps newest-first order of groups', () => {
    const groups = groupVisitsByUserDay([
      { id: 'a', userId: 'u2', createdAt: at('2026-11-23T08:00:00Z') },
      { id: 'b', userId: 'u1', createdAt: at('2026-11-23T07:00:00Z') },
      { id: 'c', userId: 'u2', createdAt: at('2026-11-23T06:00:00Z') },
    ]);
    expect(groups.map((g) => g.key.split(':')[0])).toEqual(['u2', 'u1']);
  });
});
