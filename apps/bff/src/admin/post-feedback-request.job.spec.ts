import { PostFeedbackRequestJob } from './post-feedback-request.job';
import { buildPostFeedbackBody, buildPostFeedbackCard, postFeedbackRequestPath, POST_FEEDBACK_REQUEST_KIND } from './post-feedback-message';
import { DEFAULT_REMINDER_SETTINGS, getReminderSettings, setReminderSettings } from './reminder-settings';
import type { PrismaService } from '../prisma/prisma.service';
import type { AdminService } from './admin.service';

const NOW = new Date('2026-11-03T06:00:00Z');
const HOUR = 60 * 60 * 1000;

describe('post feedback request wording', () => {
  const input = { title: '2 BHK in Adyar', location: 'Adyar, Chennai', link: 'https://www.bhavano.com/feedback/post/l1?src=in_app_message' };

  it('opens with the whole point, since that sentence is the push preview', () => {
    expect(buildPostFeedbackBody(input).split('\n\n')[0]).toBe('How was posting "2 BHK in Adyar"? Your answer helps us make posting easier.');
    expect(buildPostFeedbackBody(input)).toContain(`Share feedback: ${input.link}`);
  });

  it('is a feedback_request card (not a Boost card, so no build opens the Boost picker) linking to the feedback page', () => {
    const card = buildPostFeedbackCard(input, { id: 'l1', imageUrl: null });
    expect(card.kind).toBe('feedback_request');
    expect(card.ctaPath).toBe(postFeedbackRequestPath('l1'));
    expect(card.ctaPath).toBe('/feedback/post/l1?src=in_app_message');
    expect(card.ctaLabel).toBe('Share feedback');
  });
});

function makeJob(over: { settings?: Record<string, unknown> | null; candidates?: { id: string; ownerId: string }[]; sendResult?: boolean | Error } = {}) {
  const findMany = jest.fn().mockResolvedValue(over.candidates ?? []);
  const create = jest.fn().mockResolvedValue({});
  const prisma = {
    reminderSetting: { findUnique: jest.fn().mockResolvedValue(over.settings === undefined ? null : over.settings) },
    user: { findFirst: jest.fn().mockResolvedValue({ id: 'admin1' }) },
    listing: { findMany },
    listingNotificationLog: { create },
  } as unknown as PrismaService;
  const sendPostFeedbackRequest = jest.fn().mockImplementation(() => {
    const r = over.sendResult ?? true;
    return r instanceof Error ? Promise.reject(r) : Promise.resolve(r);
  });
  const job = new PostFeedbackRequestJob(prisma, { sendPostFeedbackRequest } as unknown as AdminService);
  return { job, findMany, create, sendPostFeedbackRequest };
}

describe('PostFeedbackRequestJob', () => {
  it('asks for ads that went live between 48 and 120 hours ago, with no answer, no earlier request and no recent in-app message', async () => {
    const { job, findMany } = makeJob();
    await job.sendRequests(NOW);
    const where = findMany.mock.calls[0][0].where;
    expect(where.createdAt.lte).toEqual(new Date(NOW.getTime() - 48 * HOUR));
    expect(where.createdAt.gt).toEqual(new Date(NOW.getTime() - 120 * HOUR));
    expect(where.postFeedbacks).toEqual({ none: {} });
    expect(where.notificationLogs.none.OR).toEqual([
      { kind: POST_FEEDBACK_REQUEST_KIND },
      { channel: 'in_app', sentAt: { gte: new Date(NOW.getTime() - 12 * HOUR) } },
    ]);
    expect(where.owner.phone).toEqual({ not: '9000000002' });
    expect(where.owner.listings.none.notificationLogs.some.kind).toBe(POST_FEEDBACK_REQUEST_KIND);
  });

  it('uses the hours set in Admin settings, and does nothing when switched off', async () => {
    const custom = makeJob({ settings: { ...DEFAULT_REMINDER_SETTINGS, feedbackRequestHours: 24 } });
    await custom.job.sendRequests(NOW);
    expect(custom.findMany.mock.calls[0][0].where.createdAt.lte).toEqual(new Date(NOW.getTime() - 24 * HOUR));

    const off = makeJob({ settings: { ...DEFAULT_REMINDER_SETTINGS, feedbackRequestEnabled: false }, candidates: [{ id: 'l1', ownerId: 'o1' }] });
    expect(await off.job.sendRequests(NOW)).toBe(0);
    expect(off.findMany).not.toHaveBeenCalled();
  });

  it('sends one request per owner per run', async () => {
    const { job, sendPostFeedbackRequest } = makeJob({
      candidates: [
        { id: 'l1', ownerId: 'o1' },
        { id: 'l2', ownerId: 'o1' },
        { id: 'l3', ownerId: 'o2' },
      ],
    });
    expect(await job.sendRequests(NOW)).toBe(2);
    expect(sendPostFeedbackRequest.mock.calls.map((c) => c[0])).toEqual(['l1', 'l3']);
  });

  it('marks an ad that cannot be messaged as skipped so it is not retried every hour, and retries a failed send', async () => {
    const skipped = makeJob({ candidates: [{ id: 'l1', ownerId: 'o1' }], sendResult: false });
    expect(await skipped.job.sendRequests(NOW)).toBe(0);
    expect(skipped.create).toHaveBeenCalledWith({ data: { listingId: 'l1', kind: POST_FEEDBACK_REQUEST_KIND, channel: 'skipped' } });

    const failed = makeJob({ candidates: [{ id: 'l1', ownerId: 'o1' }], sendResult: new Error('boom') });
    expect(await failed.job.sendRequests(NOW)).toBe(0);
    expect(failed.create).not.toHaveBeenCalled();
  });
});

describe('reminder settings with the feedback request', () => {
  it('defaults to on, 48 hours', async () => {
    const prisma = { reminderSetting: { findUnique: jest.fn().mockResolvedValue(null) } } as unknown as PrismaService;
    expect(await getReminderSettings(prisma)).toMatchObject({ feedbackRequestEnabled: true, feedbackRequestHours: 48 });
  });

  it('keeps the defaults when an older admin build saves without the new fields, and clamps a bad value', async () => {
    const upsert = jest.fn().mockResolvedValue({});
    const prisma = { reminderSetting: { upsert, findUnique: jest.fn().mockResolvedValue(null) } } as unknown as PrismaService;
    const base = { featuredExpiryEnabled: true, featuredExpiryDays: [3, 1], followupEnabled: true, followupHours: [24] };
    await setReminderSettings(prisma, base);
    expect(upsert.mock.calls[0][0].update).toMatchObject({ feedbackRequestEnabled: true, feedbackRequestHours: 48 });
    await setReminderSettings(prisma, { ...base, feedbackRequestHours: 9999, feedbackRequestEnabled: false });
    expect(upsert.mock.calls[1][0].update).toMatchObject({ feedbackRequestEnabled: false, feedbackRequestHours: 48 });
  });
});
