import { scheduledPublishAt } from './posted-confirmation-settings';

const NOW = new Date('2026-10-22T10:00:00Z');

describe('scheduledPublishAt', () => {
  it('is the Posted confirmation time after now, when the hold is on', () => {
    expect(scheduledPublishAt(NOW, { delayMinutes: 60, holdAdLive: true })?.toISOString()).toBe('2026-10-22T11:00:00.000Z');
  });

  it('publishes at once when the hold is off, whatever the wait', () => {
    expect(scheduledPublishAt(NOW, { delayMinutes: 60, holdAdLive: false })).toBeNull();
  });

  it('publishes at once when the wait is zero', () => {
    expect(scheduledPublishAt(NOW, { delayMinutes: 0, holdAdLive: true })).toBeNull();
  });

  it('publishes at once for an ad that is not eligible (no settings read)', () => {
    expect(scheduledPublishAt(NOW, null)).toBeNull();
  });
});
