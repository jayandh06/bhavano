import {
  classifyVisitEntry,
  rolloutBucket,
  shouldShowAppLoginPrompt,
  shouldShowWebLoginPrompt,
} from '@bhavano/types/loginNudge';
import { ownerEnquiryText, whatsAppChatUrl, whatsAppNumber } from '@bhavano/types/whatsapp';
import { DEFAULT_LOGIN_NUDGE_SETTINGS, LoginNudgeService } from './login-nudge.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { ContactRevealService } from '../contact-reveal/contact-reveal.service';

const DAY = 86_400_000;
const NOW = 1_800_000_000_000;

/** A viewer key whose rollout bucket is below / at-or-above `percent`. */
function keyInBucket(test: (bucket: number) => boolean): string {
  for (let i = 0; i < 10_000; i++) {
    const key = `viewer-${i}`;
    if (test(rolloutBucket(key))) return key;
  }
  throw new Error('no key found');
}

describe('classifyVisitEntry', () => {
  it('treats ad click ids and paid utm_medium as an ad visit', () => {
    expect(classifyVisitEntry('?gclid=abc', '')).toBe('ad');
    expect(classifyVisitEntry('?x=1&gbraid=abc', 'https://www.google.com/')).toBe('ad');
    expect(classifyVisitEntry('?utm_source=google&utm_medium=CPC', '')).toBe('ad');
  });

  it('treats a search engine referrer as a search visit', () => {
    expect(classifyVisitEntry('', 'https://www.google.com/')).toBe('search');
    expect(classifyVisitEntry('', 'https://www.google.co.in/search?q=flat')).toBe('search');
    expect(classifyVisitEntry('', 'https://www.bing.com/')).toBe('search');
  });

  it('treats everything else as other', () => {
    expect(classifyVisitEntry('', '')).toBe('other');
    expect(classifyVisitEntry('?utm_medium=email', 'https://bhavano.com/')).toBe('other');
    expect(classifyVisitEntry('', 'https://notgoogle.example.com/')).toBe('other');
    expect(classifyVisitEntry('?%E0%A4=1', '')).toBe('other');
  });
});

describe('rolloutBucket', () => {
  it('is stable and within 0-99', () => {
    for (const key of ['a', 'viewer-123', 'user:abc', '']) {
      const bucket = rolloutBucket(key);
      expect(bucket).toBeGreaterThanOrEqual(0);
      expect(bucket).toBeLessThan(100);
      expect(rolloutBucket(key)).toBe(bucket);
    }
  });
});

describe('shouldShowWebLoginPrompt', () => {
  const base = {
    enabled: true,
    afterDetailViews: 2,
    rolloutPercent: 100,
    excludeAdAndSearchLanding: true,
    cooldownDays: 7,
    detailViewsThisSession: 2,
    visitEntry: 'other' as const,
    viewerKey: 'viewer-1',
    dismissedAtMs: null,
    shownThisSession: false,
    nowMs: NOW,
  };

  it('shows on the second listing of a plain visit', () => {
    expect(shouldShowWebLoginPrompt(base)).toBe(true);
  });

  it('never shows on the first listing, even if the setting says 1', () => {
    expect(shouldShowWebLoginPrompt({ ...base, afterDetailViews: 1, detailViewsThisSession: 1 })).toBe(false);
  });

  it('waits for the configured number of listings', () => {
    expect(shouldShowWebLoginPrompt({ ...base, afterDetailViews: 3, detailViewsThisSession: 2 })).toBe(false);
    expect(shouldShowWebLoginPrompt({ ...base, afterDetailViews: 3, detailViewsThisSession: 3 })).toBe(true);
  });

  it('skips visits that began from an ad or search unless that exclusion is off', () => {
    expect(shouldShowWebLoginPrompt({ ...base, visitEntry: 'ad' })).toBe(false);
    expect(shouldShowWebLoginPrompt({ ...base, visitEntry: 'search' })).toBe(false);
    expect(shouldShowWebLoginPrompt({ ...base, visitEntry: 'search', excludeAdAndSearchLanding: false })).toBe(true);
  });

  it('shows once per session and respects the disabled switch', () => {
    expect(shouldShowWebLoginPrompt({ ...base, shownThisSession: true })).toBe(false);
    expect(shouldShowWebLoginPrompt({ ...base, enabled: false })).toBe(false);
  });

  it('only shows to viewers inside the rollout', () => {
    const inside = keyInBucket((b) => b < 50);
    const outside = keyInBucket((b) => b >= 50);
    expect(shouldShowWebLoginPrompt({ ...base, rolloutPercent: 50, viewerKey: inside })).toBe(true);
    expect(shouldShowWebLoginPrompt({ ...base, rolloutPercent: 50, viewerKey: outside })).toBe(false);
    expect(shouldShowWebLoginPrompt({ ...base, rolloutPercent: 0 })).toBe(false);
  });

  it('stays quiet during the cooldown after "Not now"', () => {
    expect(shouldShowWebLoginPrompt({ ...base, dismissedAtMs: NOW - 6 * DAY })).toBe(false);
    expect(shouldShowWebLoginPrompt({ ...base, dismissedAtMs: NOW - 8 * DAY })).toBe(true);
    expect(shouldShowWebLoginPrompt({ ...base, cooldownDays: 0, dismissedAtMs: NOW })).toBe(true);
  });
});

describe('shouldShowAppLoginPrompt', () => {
  const base = { enabled: true, afterDetailViews: 1, cooldownDays: 7, detailViews: 1, dismissedAtMs: null, nowMs: NOW };

  it('shows from the configured listing count', () => {
    expect(shouldShowAppLoginPrompt(base)).toBe(true);
    expect(shouldShowAppLoginPrompt({ ...base, afterDetailViews: 3, detailViews: 2 })).toBe(false);
    expect(shouldShowAppLoginPrompt({ ...base, afterDetailViews: 3, detailViews: 3 })).toBe(true);
  });

  it('respects the disabled switch and the cooldown', () => {
    expect(shouldShowAppLoginPrompt({ ...base, enabled: false })).toBe(false);
    expect(shouldShowAppLoginPrompt({ ...base, dismissedAtMs: NOW - DAY })).toBe(false);
    expect(shouldShowAppLoginPrompt({ ...base, dismissedAtMs: NOW - 8 * DAY })).toBe(true);
  });
});

describe('whatsapp helpers', () => {
  it('adds the Indian country code to a bare 10-digit number', () => {
    expect(whatsAppNumber('98765 43210')).toBe('919876543210');
    expect(whatsAppNumber('+91 98765-43210')).toBe('919876543210');
    expect(whatsAppNumber('12345')).toBeNull();
  });

  it('builds a wa.me link with the enquiry pre-filled', () => {
    expect(whatsAppChatUrl('9876543210', ownerEnquiryText('2BHK & balcony'))).toBe(
      `https://wa.me/919876543210?text=${encodeURIComponent('Hi, I saw your listing "2BHK & balcony" on Bhavano. Is it still available?')}`,
    );
    expect(whatsAppChatUrl('abc', 'hi')).toBeNull();
  });
});

describe('LoginNudgeService.getPublic', () => {
  it('creates the defaults on first read and adds the free reveal count', async () => {
    const create = jest.fn(({ data }: { data: object }) => Promise.resolve(data));
    const prisma = {
      loginNudgeSetting: { findUnique: jest.fn().mockResolvedValue(null), create },
    } as unknown as PrismaService;
    const contactReveal = {
      getSettings: jest.fn().mockResolvedValue({ freeRevealsPerUser: 3 }),
    } as unknown as ContactRevealService;

    const result = await new LoginNudgeService(prisma, contactReveal).getPublic();

    expect(create).toHaveBeenCalledWith({ data: { id: 'singleton', ...DEFAULT_LOGIN_NUDGE_SETTINGS } });
    expect(result).toEqual({ ...DEFAULT_LOGIN_NUDGE_SETTINGS, freeRevealsPerUser: 3 });
  });
});
