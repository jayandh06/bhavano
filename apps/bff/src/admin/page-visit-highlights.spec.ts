import { hasHighlight, visitHighlights, type SessionListingFacts } from './page-visit-highlights';

const NOW = new Date('2026-11-01T10:00:00Z');
const FUTURE = new Date('2026-12-01T00:00:00Z');
const PAST = new Date('2026-10-01T00:00:00Z');

function listing(over: Partial<SessionListingFacts> = {}): SessionListingFacts {
  return { publishState: 'live', status: 'active', expiresAt: FUTURE, boostedUntil: null, everBoosted: false, ...over };
}

function run(over: Partial<Parameters<typeof visitHighlights>[0]> = {}) {
  return visitHighlights({ listings: [], userIds: [], paidUserIds: new Set(), activeUserIds: new Set(), now: NOW, ...over });
}

describe('visitHighlights', () => {
  it('leaves a plain visit unmarked', () => {
    const h = run();
    expect(h).toEqual({ ad: null, featured: null, purchased: false, activePurchase: false });
    expect(hasHighlight(h)).toBe(false);
  });

  it('marks an ad that is live now, and one still in the pipeline', () => {
    expect(run({ listings: [listing()] }).ad).toBe('live');
    expect(run({ listings: [listing({ publishState: 'pending_checkout' })] }).ad).toBe('pipeline');
    expect(run({ listings: [listing({ publishState: 'scheduled' })] }).ad).toBe('pipeline');
  });

  it('does not mark an ad that is over, hidden or unclaimed', () => {
    expect(run({ listings: [listing({ status: 'sold' })] }).ad).toBeNull();
    expect(run({ listings: [listing({ status: 'deactivated' })] }).ad).toBeNull();
    expect(run({ listings: [listing({ expiresAt: PAST })] }).ad).toBeNull();
    expect(run({ listings: [listing({ publishState: 'awaiting_claim' })] }).ad).toBeNull();
  });

  it('prefers live over pipeline when a session posted both', () => {
    const both = [listing({ publishState: 'pending_checkout' }), listing()];
    expect(run({ listings: both }).ad).toBe('live');
    expect(run({ listings: [...both].reverse() }).ad).toBe('live');
  });

  it('tells a featured listing that is running from one that lapsed', () => {
    expect(run({ listings: [listing({ boostedUntil: FUTURE, everBoosted: true })] }).featured).toBe('active');
    expect(run({ listings: [listing({ boostedUntil: PAST, everBoosted: true })] }).featured).toBe('past');
    expect(run({ listings: [listing({ everBoosted: true })] }).featured).toBe('past');
    expect(run({ listings: [listing()] }).featured).toBeNull();
  });

  it('keeps an active boost over a lapsed one on another listing', () => {
    const l = [listing({ boostedUntil: PAST, everBoosted: true }), listing({ boostedUntil: FUTURE, everBoosted: true })];
    expect(run({ listings: l }).featured).toBe('active');
  });

  it('marks a buyer by any account in the session, and active only when something is running', () => {
    const h = run({ userIds: ['a', 'b'], paidUserIds: new Set(['b']), activeUserIds: new Set() });
    expect(h.purchased).toBe(true);
    expect(h.activePurchase).toBe(false);
    expect(run({ userIds: ['a'], paidUserIds: new Set(['a']), activeUserIds: new Set(['a']) }).activePurchase).toBe(true);
    expect(run({ userIds: [], paidUserIds: new Set(['a']) }).purchased).toBe(false);
  });
});
