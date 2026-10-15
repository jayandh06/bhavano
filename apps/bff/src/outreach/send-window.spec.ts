import { isWithinPromotionalSendWindow } from './send-window';

// IST is UTC+5:30, so 09:00 IST is 03:30 UTC.

describe('isWithinPromotionalSendWindow', () => {
  it('is closed before 09:00 IST, including the 07:09 run that failed in production', () => {
    expect(isWithinPromotionalSendWindow(new Date('2026-10-15T01:39:00Z'))).toBe(false); // 07:09 IST
    expect(isWithinPromotionalSendWindow(new Date('2026-10-15T03:29:00Z'))).toBe(false); // 08:59 IST
  });

  it('opens at 09:00 IST', () => {
    expect(isWithinPromotionalSendWindow(new Date('2026-10-15T03:30:00Z'))).toBe(true);
    expect(isWithinPromotionalSendWindow(new Date('2026-10-15T10:00:00Z'))).toBe(true); // 15:30 IST
  });

  it('closes at 21:00 IST', () => {
    expect(isWithinPromotionalSendWindow(new Date('2026-10-15T15:29:00Z'))).toBe(true); // 20:59 IST
    expect(isWithinPromotionalSendWindow(new Date('2026-10-15T15:30:00Z'))).toBe(false); // 21:00 IST
  });

  it('is closed overnight, including midnight IST', () => {
    expect(isWithinPromotionalSendWindow(new Date('2026-10-15T18:30:00Z'))).toBe(false); // 00:00 IST
    expect(isWithinPromotionalSendWindow(new Date('2026-10-15T22:00:00Z'))).toBe(false); // 03:30 IST
  });

  it('uses India time regardless of the server timezone', () => {
    // 22:00 UTC is a "night" hour in UTC but 03:30 IST — closed; 04:00 UTC is 09:30 IST — open.
    expect(isWithinPromotionalSendWindow(new Date('2026-10-15T04:00:00Z'))).toBe(true);
  });

});
