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
 * Deliberately not UA-sniffed differently for `fromApp` requests: the native app's own fetch
 * sends whatever User-Agent its platform defaults to, which this reads the same way as a browser
 * UA. There's no iOS app yet to distinguish from Android, so a null or unexpected result for an
 * app-originated row isn't a bug to chase down — just not useful information yet.
 */
export function osFromUserAgent(userAgent: string | undefined): OsFamily | null {
  if (!userAgent) return null;
  if (/Android/i.test(userAgent)) return 'android';
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios';
  return null;
}
