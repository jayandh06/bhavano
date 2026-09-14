import { useEffect } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { AppThemeProvider, useAppTheme } from "../src/theme/ThemeContext";
import { HomeSheetsProvider, useHomeSheets } from "../src/context/HomeSheetsProvider";
import { useCitiesQuery, useUnreadCountSync } from "../src/lib/queries";
import { configureNotificationHandler, onMessageNotificationTap } from "../src/lib/push";
import { requestTrackingConsent } from "../src/lib/trackingConsent";
import { BottomTabBar } from "../src/components/home/BottomTabBar";

const queryClient = new QueryClient();

// Once, at module load — decides how a push behaves while the app is foregrounded. A no-op if
// the notifications native module isn't in this binary (see push.ts).
configureNotificationHandler();

/** Keeps the unread count live and turns a tapped "new message" notification into a jump to that
 * thread. Lives inside HomeSheetsProvider so it can read the session token. */
function PushBridge() {
  const { accessToken } = useHomeSheets();
  const router = useRouter();

  useUnreadCountSync(accessToken);

  useEffect(
    () => onMessageNotificationTap((conversationId) => router.push(`/messages/${conversationId}`)),
    [router],
  );

  return null;
}

// Lifted above the (tabs) group so app/listing/[id].tsx (a stack screen outside
// the tabs) can also reach requireLogin/city state via useHomeSheets().
function AppNavigation() {
  const { data: popularCities } = useCitiesQuery();
  const { colors } = useAppTheme();

  // A beat after the home screen paints, not at cold-launch — asking before the user has seen
  // anything of the app has worse opt-in rates and no context for what's being asked. iOS only
  // ever shows this once per app per its own reset (requestTrackingConsent is a no-op resolve on
  // every later mount), so this doesn't re-prompt on navigation.
  useEffect(() => {
    const timer = setTimeout(() => void requestTrackingConsent(), 1200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <HomeSheetsProvider popularCities={popularCities ?? []}>
      <PushBridge />
      {/* Every screen runs headerShown:false and draws its own header, so nothing was reserving
          the status-bar area — content rendered under the clock, Dynamic Island and Wi-Fi icons
          on notched devices. SafeAreaProvider alone doesn't fix this: it supplies inset values,
          it doesn't apply them. Top edge only — BottomTabBar reserves its own bottom inset, and
          adding "bottom" here too would double it.
          `chrome` fills the status-bar strip with the brand colour (iOS has no status-bar
          background of its own — it shows whatever view sits behind it); the forced-light
          StatusBar below keeps the clock/battery legible on it in both themes. */}
      <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.chrome }}>
        <View style={{ flex: 1 }}>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
        </View>
        {/* Sibling of the Stack, not owned by it — see BottomTabBar's own doc for why this has
            to live here rather than inside the (tabs) group to stay visible on every screen. */}
        <BottomTabBar />
      </SafeAreaView>
    </HomeSheetsProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AppThemeProvider>
            <BottomSheetModalProvider>
              {/* Always light: the status-bar strip is `chrome` (dark) in both themes. */}
              <StatusBar style="light" />
              <AppNavigation />
            </BottomSheetModalProvider>
          </AppThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
