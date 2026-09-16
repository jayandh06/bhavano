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
