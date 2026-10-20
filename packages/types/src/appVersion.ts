/** Forced app updates: the server publishes the lowest app version it still supports per platform,
 * and the app shows a blocking "update required" screen when its own version is below that. An
 * empty string means "no minimum", which is the default, so nobody is locked out until an admin
 * sets one. See docs/plans/forced-app-update.md. */
export interface AppVersionSettingsDto {
  /** Lowest Android app version still allowed, like "1.2.0". Empty = no minimum. */
  androidMinVersion: string;
  /** Lowest iOS app version still allowed, like "1.2.0". Empty = no minimum. */
  iosMinVersion: string;
  /** Optional line shown on the blocking screen, above the Update button. */
  message: string;
}

/** A dotted version such as "1.2.0": one to three numeric parts, no letters. */
export const APP_VERSION_PATTERN = /^\d{1,4}(\.\d{1,4}){0,2}$/;

export function isValidAppVersion(value: string): boolean {
  return APP_VERSION_PATTERN.test(value);
}

function parts(version: string): number[] {
  return version.split(".").map((n) => Number(n));
}

/** Negative when `a` is older than `b`, 0 when equal, positive when newer. "1.2" equals "1.2.0". */
export function compareAppVersions(a: string, b: string): number {
  const pa = parts(a);
  const pb = parts(b);
  for (let i = 0; i < Math.max(pa.length, pb.length, 3); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** True only when a valid minimum is set and `current` is below it. Anything unreadable, on either
 * side, answers false: a bad value must never lock people out of the app. */
export function isBelowMinAppVersion(current: string | null | undefined, min: string | null | undefined): boolean {
  if (!current || !min) return false;
  if (!isValidAppVersion(current) || !isValidAppVersion(min)) return false;
  return compareAppVersions(current, min) < 0;
}
