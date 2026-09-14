import { Platform } from "react-native";
import * as TrackingTransparency from "expo-tracking-transparency";

/** Backend reports signup/post-ad conversions to Google Ads using hashed email/phone (see
 * apps/bff/src/ads/google-ads-conversion.provider.ts) — "tracking" under Apple's definition even
 * without an IDFA, so it needs this consent first on iOS. Android has no equivalent concept.
 * `null` means "not asked yet this session" — bffClient.ts only sends the `X-Tracking-Authorized`
 * header once this is explicitly `false`, so an unanswered/mid-flight state behaves exactly like
 * "authorized" (today's pre-ATT default), never like a silent denial. */
let cachedAuthorized: boolean | null = null;

/** Shows the system ATT prompt if the user hasn't answered it yet (a no-op, instant resolve, on
 * every later call — iOS only ever asks once per app per its own reset). Call this once, early
 * in the app's lifecycle (see app/_layout.tsx) — later reads use isTrackingAuthorized() instead
 * of re-prompting. */
export async function requestTrackingConsent(): Promise<boolean> {
  if (Platform.OS !== "ios") {
    cachedAuthorized = true;
    return true;
  }
  const { status } = await TrackingTransparency.getTrackingPermissionsAsync();
  const resolved =
    status === "undetermined"
      ? (await TrackingTransparency.requestTrackingPermissionsAsync()).status
      : status;
  cachedAuthorized = resolved === "granted";
  return cachedAuthorized;
}

export function isTrackingAuthorized(): boolean | null {
  return cachedAuthorized;
}
