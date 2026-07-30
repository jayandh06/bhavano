import { OutreachCampaignJob } from './outreach-campaign.job';
import { OutreachService } from './outreach.service';
import { OutreachSenderService } from './outreach-sender.service';
import { PrismaService } from '../prisma/prisma.service';

function makeJob(eligible: Record<string, unknown>[], campaignOverrides: Record<string, unknown> = {}) {
  const prisma = {
    outreachContact: {
      findUnique: jest.fn().mockResolvedValue({ city: { name: 'Pune' } }),
      update: jest.fn(),
    },
    outreachCampaign: { update: jest.fn() },
    campaignSend: {
      create: jest.fn().mockResolvedValue({ id: 's1' }),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  } as unknown as PrismaService;

  const outreach = {
    resolveEligible: jest.fn().mockResolvedValue({ contacts: eligible }),
  } as unknown as OutreachService;

  const sender = { send: jest.fn().mockResolvedValue({ ok: true, providerRef: 'ref1' }) } as unknown as OutreachSenderService;

  const campaign = {
    id: 'k1',
    name: 'Test',
    channel: 'sms',
    bodyTemplate: 'Hi {{name}}. Reply STOP to opt out.',
    dltTemplateId: 'DLT1',
    dryRun: false,
    cadenceCron: null,
    lastRunAt: null,
    ...campaignOverrides,
  } as never;

  return { job: new OutreachCampaignJob(prisma, outreach, sender), prisma, sender, campaign };
}

const contact = { id: 'c1', name: 'Acme', phoneE164: '+919876543210', email: null, status: 'new' };

describe('OutreachCampaignJob.runCampaign', () => {
  it('sends to an eligible contact and records the send', async () => {
    const { job, prisma, sender, campaign } = makeJob([contact]);

    const result = await job.runCampaign(campaign);

    expect(sender.send).toHaveBeenCalledWith('sms', '+919876543210', 'Hi Acme. Reply STOP to opt out.', 'DLT1');
    expect(result.sent).toBe(1);
    // lastContactedAt/contactedCount are bumped in the same transaction as the send row.
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('a dry-run campaign never calls the provider', async () => {
    const { job, sender, campaign } = makeJob([contact], { dryRun: true });

    const result = await job.runCampaign(campaign);

    expect(sender.send).not.toHaveBeenCalled();
    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('claims the send row before dispatching, so a retry cannot double-send', async () => {
    const { job, prisma, campaign } = makeJob([contact]);

    await job.runCampaign(campaign);

    const createOrder = (prisma.campaignSend.create as jest.Mock).mock.invocationCallOrder[0];
    const sendArgs = (prisma.campaignSend.create as jest.Mock).mock.calls[0][0];
    expect(sendArgs.data).toMatchObject({ campaignId: 'k1', contactId: 'c1', runKey: 'once', status: 'queued' });
    expect(createOrder).toBeLessThan((prisma.$transaction as jest.Mock).mock.invocationCallOrder[0]);
  });

  it('a unique-constraint clash on the send row is counted as skipped, not retried', async () => {
    const { job, prisma, campaign } = makeJob([contact]);
    (prisma.campaignSend.create as jest.Mock).mockRejectedValue(new Error('Unique constraint failed'));

    const result = await job.runCampaign(campaign);

    expect(result.skipped).toBe(1);
    expect(result.sent).toBe(0);
  });

  it('records a provider failure against the send row instead of throwing', async () => {
    const { job, prisma, sender, campaign } = makeJob([contact]);
    (sender.send as jest.Mock).mockResolvedValue({ ok: false, error: 'MSG91 429' });

    const result = await job.runCampaign(campaign);

    expect(result.failed).toBe(1);
    expect((prisma.campaignSend.update as jest.Mock).mock.calls[0][0].data).toMatchObject({
      status: 'failed',
      failureReason: 'MSG91 429',
    });
  });

  it('marks a one-shot campaign completed but leaves a recurring one running', async () => {
    const oneShot = makeJob([contact]);
    await oneShot.job.runCampaign(oneShot.campaign);
    expect((oneShot.prisma.outreachCampaign.update as jest.Mock).mock.calls[0][0].data.status).toBe('completed');

    const recurring = makeJob([contact], { cadenceCron: '0 10 * * *' });
    await recurring.job.runCampaign(recurring.campaign);
    expect((recurring.prisma.outreachCampaign.update as jest.Mock).mock.calls[0][0].data.status).toBe('running');
  });
});
