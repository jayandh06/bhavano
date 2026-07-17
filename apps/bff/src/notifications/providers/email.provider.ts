import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailProvider {
  private readonly logger = new Logger(EmailProvider.name);
  private readonly resend: Resend | null;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    this.resend = apiKey ? new Resend(apiKey) : null;
  }

  /** Best-effort — notifications are a side effect of moderation actions, not the action
   * itself, so a missing/failed send is logged rather than thrown (unlike OTP delivery,
   * where the caller genuinely can't proceed without it). */
  async send(to: string, subject: string, text: string): Promise<void> {
    if (!this.resend) {
      this.logger.warn(`RESEND_API_KEY is not configured — skipping email to ${to}: "${subject}"`);
      return;
    }

    const from = this.config.get<string>('RESEND_FROM_EMAIL') ?? 'Bhavano <onboarding@resend.dev>';
    try {
      await this.resend.emails.send({ from, to, subject, text });
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}: ${error instanceof Error ? error.message : error}`);
    }
  }
}
