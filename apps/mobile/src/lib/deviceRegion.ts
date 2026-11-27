import type * as ExpoLocalization from "expo-localization";

/** The time zones of the 50 states and Washington, D.C., with the older names some phones still report. */
const US_TIME_ZONES = new Set([
  // Eastern
  "America/New_York", "America/Detroit", "America/Kentucky/Louisville", "America/Kentucky/Monticello", "America/Louisville",
  "America/Indiana/Indianapolis", "America/Indiana/Vincennes", "America/Indiana/Winamac", "America/Indiana/Marengo",
  "America/Indiana/Petersburg", "America/Indiana/Vevay", "America/Indianapolis", "America/Fort_Wayne",
  // Central
  "America/Chicago", "America/Indiana/Tell_City", "America/Indiana/Knox", "America/Knox_IN", "America/Menominee",
  "America/North_Dakota/Center", "America/North_Dakota/New_Salem", "America/North_Dakota/Beulah",
  // Mountain
  "America/Denver", "America/Boise", "America/Phoenix", "America/Shiprock",
  // Pacific, Alaska, Hawaii
  "America/Los_Angeles", "America/Anchorage", "America/Juneau", "America/Sitka", "America/Metlakatla", "America/Yakutat",
  "America/Nome", "America/Adak", "America/Atka", "Pacific/Honolulu",
  // Aliases
  "US/Eastern", "US/Central", "US/Mountain", "US/Pacific", "US/Arizona", "US/Alaska", "US/Aleutian", "US/Hawaii",
  "US/Michigan", "US/East-Indiana", "US/Indiana-Starke",
]);

/**
 * Whether the phone looks like it is set up for the United States: its region is "US" and its time zone is an American one. Both are settings,
 * not where the phone is: no location is read.
 *
 * The region alone is not enough. Android takes it from the language, so a phone in India set to "English (United States)" reports "US".
 *
 * `expo-localization` is a native module added after version 1.6.0, so it is required only when asked, inside a `try`: an app without it (an older
 * binary receiving an over-the-air update) must get false, never a crash.
 */
export function isUsPhone(): boolean {
  try {
    const localization = require("expo-localization") as typeof ExpoLocalization;
    if (localization.getLocales()[0]?.regionCode !== "US") return false;
    return US_TIME_ZONES.has(localization.getCalendars()[0]?.timeZone ?? "");
  } catch {
    return false;
  }
}
