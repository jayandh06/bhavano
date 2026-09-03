import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { AppThemeProvider } from "../src/theme/ThemeContext";
import { HomeSheetsProvider, useHomeSheets } from "../src/context/HomeSheetsProvider";
import { useCitiesQuery, useUnreadCountSync } from "../src/lib/queries";
import { configureNotificationHandler, onMessageNotificationTap } from "../src/lib/push";

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

  return (
    <HomeSheetsProvider popularCities={popularCities ?? []}>
      <PushBridge />
      {/* Every screen runs headerShown:false and draws its own header, so nothing was reserving
          the status-bar area — content rendered under the clock, Dynamic Island and Wi-Fi icons
          on notched devices. SafeAreaProvider alone doesn't fix this: it supplies inset values,
          it doesn't apply them. Top edge only — the tab bar already handles the bottom inset,
          and adding "bottom" here would double it. */}
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }} />
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
              <StatusBar style="auto" />
              <AppNavigation />
            </BottomSheetModalProvider>
          </AppThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
