export const DEVICE_TYPES = ['desktop', 'mobile', 'tablet', 'mobile_app'] as const;
export type DeviceType = (typeof DEVICE_TYPES)[number];

/**
 * Coarse device classification for the admin Page visits screen — deliberately just these four
 * buckets, not full browser/OS detection, which is all that screen needs. Order matters: tablet
 * patterns are checked first since some (e.g. Android tablets) would otherwise also match the
 * mobile pattern below.
 *
 * `fromApp` takes priority over any User-Agent parsing — see `Visit.deviceType`'s schema comment
 * for why "mobile_app" isn't actually a UA distinction at all.
 */
export function deviceTypeFromUserAgent(userAgent: string | undefined, fromApp: boolean): DeviceType {
  if (fromApp) return 'mobile_app';
  if (!userAgent) return 'desktop';

  if (/iPad|Tablet|(?:Android(?!.*Mobile))/i.test(userAgent)) return 'tablet';
  if (/Mobi|iPhone|iPod|Android|Windows Phone/i.test(userAgent)) return 'mobile';
  return 'desktop';
}

export const OS_FAMILIES = ['android', 'ios'] as const;
export type OsFamily = (typeof OS_FAMILIES)[number];

/**
 * Best-effort OS guess from the same User-Agent header `deviceTypeFromUserAgent` reads —
 * orthogonal to device type, not a replacement for it (a tablet or a phone can be either OS).
 * Null for desktop UAs and anything unrecognised, same "not classified, not a claim either way"
 * precedent as `isBot`.
 *
 * `fromApp` requests also get the native HTTP stacks' agents recognised (see the body), since the
 * app sends no browser-style UA. Rows written before that was added have no OS and cannot be
 * recovered: the UA is not stored.
 */
export function osFromUserAgent(userAgent: string | undefined, fromApp = false): OsFamily | null {
  if (!userAgent) return null;
  if (/Android/i.test(userAgent)) return 'android';
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios';
  // The native app's own requests carry the HTTP stack's User-Agent, not a browser's: React Native sends
  // `okhttp/…` on Android and `<App>/<build> CFNetwork/… Darwin/…` on iOS. Only trusted for `fromApp`
  // requests, because a bare okhttp or CFNetwork agent from anywhere else is just some API client.
  if (fromApp) {
    if (/okhttp|Dalvik/i.test(userAgent)) return 'android';
    if (/CFNetwork|Darwin/i.test(userAgent)) return 'ios';
  }
  return null;
}
