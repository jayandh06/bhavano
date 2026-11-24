import { MARKET } from '../market/market-config';
/** Admin-assisted posting: an admin prepares a listing for a seller, and it stays hidden
 * (publishState awaiting_claim) until the seller signs in with the phone staff took down and
 * publishes it. See docs/plans/admin-assisted-posting.md. */

/** Unclaimed assisted listings are deleted after this many days, so a mistyped number never
 * leaves an ad behind for good. */
export const ASSISTED_CLAIM_DAYS = 14;

/** "+919876543210" -> "+91 98xxx xx210" (the market's dial code). Enough for the seller to recognise their own number on
 * the public claim page without printing it for anyone who has the link. */
export function maskClaimPhone(
  phoneE164: string | null | undefined,
): string | null {
  if (!phoneE164) return null;
  const digits = phoneE164.replace(/\D/g, '').slice(-MARKET.phoneNationalLength);
  if (digits.length !== MARKET.phoneNationalLength) return null;
  return `+${MARKET.phoneDialCode} ${digits.slice(0, 2)}xxx xx${digits.slice(7)}`;
}

export function assistedClaimUrl(siteUrl: string, listingId: string): string {
  return `${siteUrl.replace(/\/$/, '')}/claim/${listingId}?via=assisted`;
}

export function assistedClaimCutoff(now: Date): Date {
  return new Date(now.getTime() - ASSISTED_CLAIM_DAYS * 24 * 60 * 60 * 1000);
}
