/** Rules for the permanent `bhavano_acq` cookie, which records how a visitor first arrived and is copied onto their account at
 * sign-up (User.acquisition*). See docs/plans/ad-first-click-attribution.md.
 *
 * The cookie used to be written once and never touched, so a visitor whose first visit was direct or organic kept "direct" even
 * when they came back later through an ad, and the ad that brought them was lost from the account and from the conversion
 * Bhavano reports to Google Ads. Now a later ad click replaces a non-ad landing. A cookie that already holds an ad click is left
 * alone, so the first ad click still wins and the value does not churn on every click. */

export interface AcquisitionSource {
  source?: string;
  medium?: string;
  gclid?: string;
}

/** A paid ad click: a Google click id, or a medium of `cpc` / `paid_social`. A bare `fbclid` is not one, because organic
 * Facebook clicks carry it too (the same rule the Campaign analytics "paid" filter uses). */
export function isAdClick(source: AcquisitionSource | null | undefined): boolean {
  if (!source) return false;
  return !!source.gclid || source.medium === "cpc" || source.medium === "paid_social";
}

/** What the cookie holds, or null when it is missing or not readable. */
export function parseAcquisitionCookie(raw: string | undefined): AcquisitionSource | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as AcquisitionSource) : null;
  } catch {
    return null;
  }
}

/** Whether this request should overwrite the cookie: it is an ad click, and the cookie does not already record one. */
export function shouldReplaceAcquisition(existingRaw: string | undefined, landing: AcquisitionSource): boolean {
  if (!isAdClick(landing)) return false;
  return !isAdClick(parseAcquisitionCookie(existingRaw));
}
