import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";

const VIEWER_KEY_STORAGE = "bhavano.viewerKey";

/** Persistent per-install anonymous identity — minted once, used both to dedupe/attribute
 * anonymous listing views (see app/listing/[id].tsx) and, at login, to let AuthService link
 * those pre-signup views to the now-known account (see verifyOtp/loginWithGoogle/loginWithApple
 * in bffClient.ts). Same key, same purpose, as web's ViewTracker.tsx localStorage value. */
export async function getOrCreateViewerKey(): Promise<string> {
  const existing = await AsyncStorage.getItem(VIEWER_KEY_STORAGE);
  if (existing) return existing;
  const key = Crypto.randomUUID();
  await AsyncStorage.setItem(VIEWER_KEY_STORAGE, key);
  return key;
}
