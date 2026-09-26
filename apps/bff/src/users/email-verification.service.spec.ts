import { EmailVerificationService } from './email-verification.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { EmailProvider } from '../notifications/providers/email.provider';
import type { AccountMergeService } from './account-merge.service';

describe('EmailVerificationService.requestCode', () => {
  function setup(sendResult = true) {
    const create = jest.fn().mockResolvedValue({});
    const send = jest.fn().mockResolvedValue(sendResult);
    const prisma = { emailChallenge: { create } } as unknown as PrismaService;
    const email = { send } as unknown as EmailProvider;
    const service = new EmailVerificationService(prisma, email, {} as AccountMergeService);
    return { service, send };
  }

  it('sends the branded HTML email with the same code in HTML and plain text', async () => {
    const { service, send } = setup();
    await service.requestCode('u1', 'a@example.com');

    const [to, subject, text, opts] = send.mock.calls[0] as [string, string, string, { html: string }];
    expect(to).toBe('a@example.com');
    expect(subject).toBe('Verify your email for Bhavano');
    const code = /verification code is (\d{6})/.exec(text)?.[1];
    expect(code).toBeDefined();
    expect(opts.html).toContain(code as string);
    expect(opts.html).toContain('Verify your email');
    expect(opts.html).toContain('Courier New');
    expect(text).toContain('valid for 10 minutes');
  });

  it('still surfaces a failed send to the caller', async () => {
    const { service } = setup(false);
    await expect(service.requestCode('u1', 'a@example.com')).rejects.toThrow(/Couldn't send the verification email/);
  });
});
