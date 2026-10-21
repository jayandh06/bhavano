import AsyncStorage from "@react-native-async-storage/async-storage";

/** AsyncStorage key holding the parsed Play install referrer (see installReferrer.ts). Lives in its own module so
 * analyticsSession.ts can read the website session without importing installReferrer.ts, which imports it. */
export const INSTALL_ATTRIBUTION_KEY = "bhavano.installAttribution";

/** The website session (`ws`) the install came from, if the install link carried one. Read at login so the
 * server can tie the person's earlier anonymous web visits to their account. Never throws. */
export async function readInstallWebSessionId(): Promise<string | undefined> {
  try {
    const raw = await AsyncStorage.getItem(INSTALL_ATTRIBUTION_KEY);
    if (!raw) return undefined;
    const value = (JSON.parse(raw) as { webSessionId?: unknown }).webSessionId;
    return typeof value === "string" && value ? value : undefined;
  } catch {
    return undefined;
  }
}
