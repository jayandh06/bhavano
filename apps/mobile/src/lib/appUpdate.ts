import { isBelowMinAppVersion, type AppVersionSettingsDto } from "@bhavano/types/appVersion";

export const ANDROID_PACKAGE = "com.finfolia.bhavano";
export const IOS_APP_ID = "6811878602";

/** Where the Update button sends people. Android's market:// link opens the Play Store app
 * directly (the caller falls back to the https page if no handler takes it). */
export const STORE_URLS = {
  android: `market://details?id=${ANDROID_PACKAGE}`,
  androidWeb: `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`,
  ios: `https://apps.apple.com/app/id${IOS_APP_ID}`,
} as const;

export interface UpdateRequirement {
  required: boolean;
  message: string;
}

/** Whether this install must update, given what the server says is the lowest allowed version.
 * Fails open on everything: no settings yet (still loading, or the request failed), a platform that
 * has no minimum, or a version string that can't be read all mean "carry on". A broken check must
 * never lock people out of the app. */
export function updateRequirement(
  platform: string,
  currentVersion: string | null | undefined,
  settings: AppVersionSettingsDto | null | undefined,
): UpdateRequirement {
  if (!settings) return { required: false, message: "" };
  const min = platform === "ios" ? settings.iosMinVersion : platform === "android" ? settings.androidMinVersion : "";
  return { required: isBelowMinAppVersion(currentVersion, min), message: settings.message };
}
