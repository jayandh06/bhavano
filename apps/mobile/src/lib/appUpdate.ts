import { isBelowMinAppVersion, type AppVersionSettingsDto } from "@bhavano/types/appVersion";
import { isUsPhone } from "./deviceRegion";
import { isMarketOffered } from "./marketState";

export const ANDROID_PACKAGE = "com.finfolia.bhavano";
export const IOS_APP_ID = "6811878602";

/** Where the Update button sends people. Android's market:// link opens the Play Store app
 * directly (the caller falls back to the https page if no handler takes it). */
export const STORE_URLS = {
  android: `market://details?id=${ANDROID_PACKAGE}`,
  androidWeb: `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`,
} as const;

/**
 * The App Store page the iPhone Update button opens. It must name a country that lists the app (without one the App Store says the page cannot be
 * found), and it is chosen by how the phone is set up, not by the market picked in the app, because the phone's Apple account decides which store
 * can serve it. The US page only works once the app is listed there, so only a build that offers the US asks for it.
 */
export function iosStoreUrl(): string {
  const country = isMarketOffered("us") && isUsPhone() ? "us" : "in";
  return `https://apps.apple.com/${country}/app/bhavano/id${IOS_APP_ID}`;
}

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
