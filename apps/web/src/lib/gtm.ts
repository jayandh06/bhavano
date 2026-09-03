declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

/** Pushes an event onto the GTM dataLayer — a no-op if GTM isn't loaded (e.g. NEXT_PUBLIC_GTM_ID
 * unset locally), so callers never need to guard this themselves. Actual conversion triggers
 * (Google Ads, GA4) are configured later from the GTM dashboard against these event names,
 * without needing another code deploy. */
export function pushDataLayerEvent(event: string, data?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({ event, ...data });
}

/**
 * Google Ads Enhanced Conversions wants phone numbers in E.164. This app stores bare 10-digit
 * Indian mobile numbers (a few paths may already carry a `+91`). Returns `undefined` for
 * anything that isn't a plausible 10-digit number, so a malformed value is never pushed as
 * user-provided data. The raw value goes into the dataLayer — GTM hashes it client-side.
 */
export function toE164IN(phone: string | null | undefined): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, "");
  const ten = digits.length > 10 ? digits.slice(-10) : digits;
  return ten.length === 10 ? `+91${ten}` : undefined;
}
