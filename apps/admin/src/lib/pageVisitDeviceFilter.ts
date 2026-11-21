import type { DeviceType, OsFamily } from "@bhavano/types";

/** What the Device dropdown on Page visits can hold. The plain device types, plus "Mobile (iOS / Android / Other)"
 * for mobile *browser* visits and "Mobile App (iOS / Android / Other)" for the native app: each is one pick that
 * splits by operating system. "Other" is a row whose OS was not revealed (Windows Phone, an unusual browser, or an
 * app visit recorded before the app's own User-Agent was recognised), which the BFF stores as no OS at all. */
export const DEVICE_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "any", label: "All devices" },
  { value: "desktop", label: "Desktop" },
  { value: "mobile", label: "Mobile (any OS)" },
  { value: "mobile:ios", label: "Mobile (iOS)" },
  { value: "mobile:android", label: "Mobile (Android)" },
  { value: "mobile:other", label: "Mobile (Other)" },
  { value: "tablet", label: "Tablet" },
  { value: "mobile_app", label: "Mobile App (any OS)" },
  { value: "mobile_app:ios", label: "Mobile App (iOS)" },
  { value: "mobile_app:android", label: "Mobile App (Android)" },
  { value: "mobile_app:other", label: "Mobile App (Other)" },
];

/** `os` as the BFF takes it: a real OS, or "unknown" for rows with no OS recorded. */
export type OsFilter = OsFamily | "unknown";

const COMPOUND_OS: Record<string, OsFilter> = { ios: "ios", android: "android", other: "unknown" };

/** Turns the Device dropdown value and the separate OS dropdown value into the BFF's `deviceType` and `os`.
 * A "Mobile (iOS)" pick sets both; the OS dropdown, when set to something, wins over a compound pick so the
 * two controls never silently disagree about what is filtered. Unrecognised values filter nothing. */
export function resolveDeviceFilter(
  deviceRaw: string | undefined,
  osRaw: string | undefined,
): { deviceType?: DeviceType; os?: OsFilter } {
  const explicitOs: OsFilter | undefined =
    osRaw === "android" || osRaw === "ios" || osRaw === "unknown" ? osRaw : undefined;
  if (!deviceRaw || deviceRaw === "any") return { os: explicitOs };

  const [device, suffix] = deviceRaw.split(":");
  const compoundOs = suffix ? COMPOUND_OS[suffix] : undefined;
  if (suffix && !compoundOs) return { os: explicitOs };
  if (!["desktop", "mobile", "tablet", "mobile_app"].includes(device)) return { os: explicitOs };
  return { deviceType: device as DeviceType, os: explicitOs ?? compoundOs };
}
