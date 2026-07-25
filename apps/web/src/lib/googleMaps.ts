declare global {
  interface Window {
    google?: typeof google;
    /** Set from root layout at request time — client bundles can't rely on build-time NEXT_PUBLIC_* in Docker. */
    __BHAVANO_GOOGLE_MAPS_JS_KEY__?: string;
  }
}

function googleMapsApiKey(): string {
  if (typeof window !== "undefined" && window.__BHAVANO_GOOGLE_MAPS_JS_KEY__) {
    return window.__BHAVANO_GOOGLE_MAPS_JS_KEY__;
  }
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_JS_KEY ?? "";
}

let loadPromise: Promise<void> | null = null;

/** Same dynamic-script-tag pattern as lib/razorpay.ts's loadRazorpayScript — load the vendor's
 * own script once, use its global (`window.google.maps`) directly, no SDK wrapper library.
 * Memoized so the map pin-picker's Places Autocomplete + interactive map (which both need this)
 * only ever injects the script tag once, even if both mount around the same time. */
export function loadGoogleMaps(): Promise<void> {
  if (window.google?.maps) return Promise.resolve();
  if (loadPromise) return loadPromise;

  const key = googleMapsApiKey();
  if (!key) {
    return Promise.reject(new Error("Google Maps API key is not configured"));
  }

  const scriptSrc = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places`;

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = scriptSrc;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loadPromise = null;
      reject(new Error("Failed to load Google Maps"));
    };
    document.body.appendChild(script);
  });
  return loadPromise;
}
