/** Normalizes an Indian phone number to E.164 (+91XXXXXXXXXX), or null if it can't be one.
 *
 * Dedupe and suppression both key off this rather than the raw string: the same number arrives
 * as "98765 43210", "+91-9876543210", "09876543210" and "919876543210" across Maps exports,
 * scrapes and CSVs, and treating those as four different people would both duplicate contacts
 * and let an opted-out number slip back into an audience under a different formatting.
 */
export function toE164India(raw: string | null | undefined): string | null {
  if (!raw) return null;

  const digits = raw.replace(/\D/g, '');
  // 10-digit local; Indian mobile numbers start 6-9, which also rejects landline/garbage rows.
  if (digits.length === 10) return /^[6-9]/.test(digits) ? `+91${digits}` : null;
  // 0-prefixed STD form.
  if (digits.length === 11 && digits.startsWith('0')) return toE164India(digits.slice(1));
  // Country-coded, with or without a leading +.
  if (digits.length === 12 && digits.startsWith('91')) return toE164India(digits.slice(2));

  return null;
}

/** Suppression is keyed on the same normalized value for both channels — phone as E.164,
 * email lowercased/trimmed — so a lookup never has to care which one it was given. */
export function suppressionKey(value: string): string {
  return toE164India(value) ?? value.trim().toLowerCase();
}
