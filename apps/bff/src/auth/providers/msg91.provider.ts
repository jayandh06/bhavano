import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * MSG91 OTP delivery (v5 OTP API). Requires MSG91_AUTH_KEY (and, depending on your
 * account's DLT setup, MSG91_SENDER_ID / MSG91_DLT_TEMPLATE_ID) to actually send SMS —
 * throws until those are configured rather than silently no-op'ing, since a fake success
 * would be worse than a clear "not configured yet" error.
 * Docs: https://docs.msg91.com/reference/send-otp
 */
@Injectable()
export class Msg91Provider {
  constructor(private readonly config: ConfigService) {}

  async sendOtp(phone: string, code: string): Promise<void> {
    const authKey = this.config.get<string>('MSG91_AUTH_KEY');
    if (!authKey) {
      throw new InternalServerErrorException(
        'MSG91_AUTH_KEY is not configured — set it in apps/bff/.env to enable OTP delivery.',
      );
    }

    const templateId = this.config.get<string>('MSG91_DLT_TEMPLATE_ID');
    const params = new URLSearchParams({
      mobile: `91${phone}`,
      otp: code,
      ...(templateId ? { template_id: templateId } : {}),
    });

    const res = await fetch(`https://control.msg91.com/api/v5/otp?${params.toString()}`, {
      method: 'POST',
      headers: { authkey: authKey, 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new InternalServerErrorException(`MSG91 send failed (${res.status}): ${body}`);
    }
  }
}
