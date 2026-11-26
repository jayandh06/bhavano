import type * as ExpoLocalization from "expo-localization";

/** The phone's region setting ("US", "IN"), or null when it cannot be told. This is the setting, not where the phone is: no location is read.
 *
 * `expo-localization` is a native module added after version 1.6.0, so it is required only when asked, inside a `try`: an app without it (an older
 * binary receiving an over-the-air update) must get null, never a crash. */
export function deviceRegion(): string | null {
  try {
    const localization = require("expo-localization") as typeof ExpoLocalization;
    return localization.getLocales()[0]?.regionCode ?? null;
  } catch {
    return null;
  }
}
