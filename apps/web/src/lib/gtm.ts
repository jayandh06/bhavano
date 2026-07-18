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
