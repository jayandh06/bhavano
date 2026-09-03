import { Platform } from "react-native";
import Constants from "expo-constants";
import type * as ExpoNotifications from "expo-notifications";
import { deletePushToken, registerPushToken } from "./bffClient";

/** Matches the `channelId` the BFF sets on every "new message" push (PushService). */
export const MESSAGES_CHANNEL_ID = "messages";

/**
 * `expo-notifications` is a native module, and importing it throws *synchronously* on a binary
 * that doesn't have it linked — `PushTokenManager` does `requireNativeModule('ExpoPushTokenManager')`
 * at module scope. That happens on a stale dev client (built before the dep was added), in Expo
 * Go, or if autolinking ever misses it. One such throw in a file that `app/_layout.tsx` imports
 * white-screens the whole router. So load it lazily and treat "unavailable" as a normal state:
 * push is just off for that session; everything else in the app still works.
 */
let mod: typeof ExpoNotifications | null | undefined;
function notifications(): typeof ExpoNotifications | null {
  if (mod === undefined) {
    try {
      mod = require("expo-notifications") as typeof ExpoNotifications;
    } catch {
      mod = null;
      if (Platform.OS !== "web") {
        console.warn(
          "[push] expo-notifications native module unavailable — push disabled for this session. " +
            "If you're on a dev client, rebuild it (a native dependency changed).",
        );
      }
    }
  }
  return mod;
}

/**
 * Foreground behaviour for an incoming push. The socket already keeps an open app's Messages
 * badge live, so a heads-up banner here is purely so the user notices a message landing while
 * they're on another screen; the list entry and sound come along with it. `shouldSetBadge` lets
 * the OS manage the app-icon count from the push payload too.
 */
export function configureNotificationHandler(): void {
  const N = notifications();
  if (!N) return;
  N.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

async function ensureAndroidChannel(N: typeof ExpoNotifications): Promise<void> {
  if (Platform.OS !== "android") return;
  await N.setNotificationChannelAsync(MESSAGES_CHANNEL_ID, {
    name: "Messages",
    importance: N.AndroidImportance.HIGH,
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
 * Returns null and does nothing on web, without the native module, in a simulator without push
 * support, or if the user declines — none of which are errors, just "no push for this session".
 */
export async function registerForPushAsync(accessToken: string): Promise<string | null> {
  if (Platform.OS === "web") return null;
  const N = notifications();
  if (!N) return null;

  try {
    await ensureAndroidChannel(N);

    const existing = await N.getPermissionsAsync();
    let granted = existing.granted;
    if (!granted && existing.canAskAgain) {
      const asked = await N.requestPermissionsAsync();
      granted = asked.granted;
    }
    if (!granted) return null;

    const { data: token } = await N.getExpoPushTokenAsync({ projectId: projectId() });
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
  const N = notifications();
  if (!N) return;
  try {
    await N.setBadgeCountAsync(count);
  } catch {
    // Unsupported launcher / no badge permission — harmless.
  }
}

/**
 * Runs `cb(conversationId)` for a tapped "new message" notification — both the tap that
 * cold-started the app and any received while this is mounted. Returns a cleanup function.
 * No-op (returns a no-op cleanup) without the native module.
 */
export function onMessageNotificationTap(cb: (conversationId: string) => void): () => void {
  const N = notifications();
  if (!N) return () => {};

  const conversationIdOf = (response: ExpoNotifications.NotificationResponse | null): string | undefined => {
    const data = response?.notification.request.content.data as { conversationId?: string } | undefined;
    return typeof data?.conversationId === "string" ? data.conversationId : undefined;
  };

  void N.getLastNotificationResponseAsync().then((response) => {
    const id = conversationIdOf(response);
    if (id) cb(id);
  });
  const sub = N.addNotificationResponseReceivedListener((response) => {
    const id = conversationIdOf(response);
    if (id) cb(id);
  });
  return () => sub.remove();
}
