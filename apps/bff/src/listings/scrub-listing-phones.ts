import { maskPhone } from '../logging/thirdPartyCallLogger';

/**
 * Indian mobile numbers as sellers paste them into a listing title or description:
 * bare 10 digits, leading 0, +91 / 91, and spaces / dashes / dots between digit groups.
 * Landlines and short codes (pincode, OTP) are left alone.
 */
const LISTING_PHONE_PATTERN =
  /(?:\+?91[\s\-.]*)?0?[6-9](?:[\s\-.]?\d){9}/g;

/** Digits that form the 10-digit mobile, or null if the match is not one. */
function indianMobileDigits(raw: string): string | null {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length >= 12) {
    digits = digits.slice(-10);
  } else if (digits.startsWith('0') && digits.length === 11) {
    digits = digits.slice(1);
  }
  if (digits.length !== 10 || !/^[6-9]/.test(digits)) return null;
  return digits;
}

/**
 * Replaces each Indian mobile in free text with `98******10`-style masking so a listing
 * cannot publish a full number past contact-reveal. Non-phone digit runs stay unchanged.
 */
export function scrubPhonesInText(text: string): string {
  return text.replace(LISTING_PHONE_PATTERN, (match) => {
    const mobile = indianMobileDigits(match);
    if (!mobile) return match;
    return maskPhone(mobile);
  });
}
