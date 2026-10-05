import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Application from "expo-application";
import { recordAppPageView } from "./analyticsSession";

/** Where this install came from, per the Play Install Referrer — the `referrer=` the website's
 * Play links and QR codes carry (`utm_source=bhavano_web&utm_medium=qr&utm_campaign=footer`, see
 * apps/web/src/lib/appLinks.ts), or Play's own `utm_source=google-play&utm_medium=organic`.
 * See docs/plans/drive-users-to-android-app.md. */
export interface InstallAttribution {
  source?: string;
  medium?: string;
  campaign?: string;
}

const STORAGE_KEY = "bhavano.installAttribution";
/** An app updated from a build without this code also runs it once, and Play still returns that
 * install's original referrer — only a launch this soon after installing is logged as an install. */
const FRESH_INSTALL_MS = 24 * 60 * 60 * 1000;

/** Parsed by hand: the referrer is a plain `k=v&k=v` string, and this avoids depending on how
 * complete the runtime's URLSearchParams is. */
export function parseInstallReferrer(raw: string): InstallAttribution {
  const values: Record<string, string> = {};
  for (const pair of raw.split("&")) {
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    try {
      values[decodeURIComponent(pair.slice(0, eq))] = decodeURIComponent(pair.slice(eq + 1).replace(/\+/g, " "));
    } catch {
      // A malformed escape in one pair shouldn't lose the rest.
    }
  }
  return {
    ...(values.utm_source && { source: values.utm_source }),
    ...(values.utm_medium && { medium: values.utm_medium }),
    ...(values.utm_campaign && { campaign: values.utm_campaign }),
  };
}

/** The synthetic Page-visits trail entry for a fresh install, decoded by the admin app's
 * trailEntry(). */
export function appInstallTrailPath(attribution: InstallAttribution): string {
  const parts = (["source", "medium", "campaign"] as const)
    .filter((key) => attribution[key])
    .map((key) => `${key}=${encodeURIComponent(attribution[key]!)}`);
  return parts.length > 0 ? `/app-install?${parts.join("&")}` : "/app-install";
}

/** Once per install (Android only): reads the Play install referrer, keeps it for signup
 * attribution (`installAcquisitionFields`), and logs `/app-install?…` in this launch's Page-visits
 * trail if the app was installed in the last day. A failed read is retried on the next launch. */
export async function recordInstallReferrerOnce(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    if ((await AsyncStorage.getItem(STORAGE_KEY)) !== null) return;
    const [raw, installedAt] = await Promise.all([
      Application.getInstallReferrerAsync(),
      Application.getInstallationTimeAsync(),
    ]);
    const attribution = parseInstallReferrer(raw ?? "");
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(attribution));
    if (Date.now() - installedAt.getTime() < FRESH_INSTALL_MS) {
      void recordAppPageView(appInstallTrailPath(attribution));
    }
  } catch {
    // Install Referrer service unavailable (no Play Store, transient) — nothing stored, so the
    // next launch tries again. Analytics must never surface an error.
  }
}

/** The login DTOs' @MaxLength — anything longer would fail the whole login with a 400. */
const ACQUISITION_MAX = 100;

/** The stored install referrer as the login endpoints' `acquisition*` fields. The BFF only uses
 * them on a brand-new signup (acquisitionCreateFields), never on a returning login, so sending
 * them on every login is safe. Empty when there's nothing usable. */
export async function installAcquisitionFields(): Promise<{
  acquisitionSource?: string;
  acquisitionMedium?: string;
  acquisitionCampaign?: string;
}> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (!stored) return {};
    const attribution = JSON.parse(stored) as InstallAttribution;
    if (typeof attribution.source !== "string" || !attribution.source) return {};
    const clip = (value: unknown) => (typeof value === "string" && value ? value.slice(0, ACQUISITION_MAX) : undefined);
    const medium = clip(attribution.medium);
    const campaign = clip(attribution.campaign);
    return {
      acquisitionSource: clip(attribution.source),
      ...(medium && { acquisitionMedium: medium }),
      ...(campaign && { acquisitionCampaign: campaign }),
    };
  } catch {
    return {};
  }
}
