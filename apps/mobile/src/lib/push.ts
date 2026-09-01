import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { deletePushToken, registerPushToken } from "./bffClient";

/** Matches the `channelId` the BFF sets on every "new message" push (PushService). */
export const MESSAGES_CHANNEL_ID = "messages";

/**
 * Foreground behaviour for an incoming push. The socket already keeps an open app's Messages
 * badge live, so a heads-up banner here is purely so the user notices a message landing while
 * they're on another screen; the list entry and sound come along with it. `shouldSetBadge` lets
 * the OS manage the app-icon count from the push payload too.
 */
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(MESSAGES_CHANNEL_ID, {
    name: "Messages",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#11523C",
  });
}

function projectId(): string | undefined {
  // Present in app.config.js's `extra.eas.projectId`; also injected automatically by EAS Build.
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId;
}

/**
 * Asks for notification permission (if not already decided), gets this device's Expo push token,
 * and registers it with the BFF against the logged-in user. Returns the token so the caller can
 * hand it back to {@link unregisterPushAsync} on logout.
 *
 * Returns null and does nothing on web, in a simulator without push support, or if the user
 * declines — none of which are errors, just "no push for this session".
 */
export async function registerForPushAsync(accessToken: string): Promise<string | null> {
  if (Platform.OS === "web") return null;

  try {
    await ensureAndroidChannel();

    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.granted;
    if (!granted && existing.canAskAgain) {
      const asked = await Notifications.requestPermissionsAsync();
      granted = asked.granted;
    }
    if (!granted) return null;

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: projectId() });
    await registerPushToken(accessToken, token, Platform.OS === "ios" ? "ios" : "android");
    return token;
  } catch {
    // Best-effort: a device with no push support, or a transient network failure here, must not
    // break login.
    return null;
  }
}

/** Clears this device's token from the user's account on logout. */
export async function unregisterPushAsync(accessToken: string, token: string): Promise<void> {
  try {
    await deletePushToken(accessToken, token);
  } catch {
    // The token row also gets pruned server-side once Expo reports it as unreachable, so a
    // failed cleanup here is not worth surfacing.
  }
}

export async function setAppBadgeCount(count: number): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch {
    // Unsupported launcher / no badge permission — harmless.
  }
}
