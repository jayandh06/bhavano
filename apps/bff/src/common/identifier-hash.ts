import { createHmac } from 'crypto';
import { ConfigService } from '@nestjs/config';

/**
 * One-way fingerprint for phone/email fraud-detection ledgers (ReferralPhoneLedger,
 * User.deletedPhoneHash/deletedEmailHash) — never the raw value. Salted with the same secret
 * that signs auth JWTs, the same construction as ReferralsService.hashPhone(). Unsalted
 * SHA-256 alone would be reversible by brute force for a small value space like a 10-digit
 * Indian mobile number. Rotating AUTH_JWT_SECRET orphans every existing hash ledger row, so
 * rotate it together with a rehash of anything that depends on this.
 */
export function hashIdentifier(value: string, config: ConfigService): string {
  const secret = config.get<string>('AUTH_JWT_SECRET') ?? 'dev-only-change-me';
  return createHmac('sha256', secret).update(value).digest('hex');
}
