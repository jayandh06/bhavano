import type { DeviceType, OsFamily } from "@bhavano/types";

/** What the Device dropdown on Page visits can hold. The plain device types, plus "Mobile (iOS / Android / Other)"
 * for mobile *browser* visits and "Mobile App (iOS / Android / Other)" for the native app: each is one pick that
 * splits by operating system. "Other" is a row whose OS was not revealed (Windows Phone, an unusual browser, or an
 * app visit recorded before the app's own User-Agent was recognised), which the BFF stores as no OS at all. */
export const DEVICE_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "any", label: "All devices" },
  { value: "desktop", label: "Desktop" },
  { value: "mobile", label: "Mobile" },
  { value: "mobile:ios", label: "Mobile (iOS)" },
  { value: "mobile:android", label: "Mobile (Android)" },
  { value: "mobile:other", label: "Mobile (Other)" },
  { value: "tablet", label: "Tablet" },
  { value: "tablet:ios", label: "Tablet (iOS)" },
  { value: "tablet:android", label: "Tablet (Android)" },
  { value: "mobile_app", label: "Mobile App" },
  { value: "mobile_app:ios", label: "Mobile App (iOS)" },
  { value: "mobile_app:android", label: "Mobile App (Android)" },
  { value: "mobile_app:other", label: "Mobile App (Other)" },
];

/** `os` as the BFF takes it: a real OS, or "unknown" for rows with no OS recorded. */
export type OsFilter = OsFamily | "unknown";

const COMPOUND_OS: Record<string, OsFilter> = { ios: "ios", android: "android", other: "unknown" };

/** Turns the Device dropdown value and the separate OS dropdown value into the BFF's `deviceType` and `os`.
 *
 * A "Mobile (iOS)" pick sets both and **wins** over the OS dropdown. The other way round was a bug: the page re-rendered
 * the OS dropdown showing the OS of the last pick, so choosing "Mobile (Android)" next was overridden by the leftover
 * "iOS" and showed iOS rows. The OS dropdown only applies with a plain device type (Tablet, Desktop, All devices, Mobile,
 * Mobile App). Unrecognised values filter nothing. `osDropdown` is what the OS dropdown should display. */
export function resolveDeviceFilter(
  deviceRaw: string | undefined,
  osRaw: string | undefined,
): { deviceType?: DeviceType; os?: OsFilter; osDropdown: OsFilter | undefined } {
  const explicitOs: OsFilter | undefined =
    osRaw === "android" || osRaw === "ios" || osRaw === "unknown" ? osRaw : undefined;
  if (!deviceRaw || deviceRaw === "any") return { os: explicitOs, osDropdown: explicitOs };

  const [device, suffix] = deviceRaw.split(":");
  const compoundOs = suffix ? COMPOUND_OS[suffix] : undefined;
  if ((suffix && !compoundOs) || !["desktop", "mobile", "tablet", "mobile_app"].includes(device)) {
    return { os: explicitOs, osDropdown: explicitOs };
  }
  if (compoundOs) return { deviceType: device as DeviceType, os: compoundOs, osDropdown: undefined };
  return { deviceType: device as DeviceType, os: explicitOs, osDropdown: explicitOs };
}
