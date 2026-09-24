import { useEffect, type ReactNode } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import type { ErrorUtils } from "react-native";
import { StatusBar } from "expo-status-bar";
import { AppThemeProvider, useAppTheme } from "../src/theme/ThemeContext";
import { HomeSheetsProvider, useHomeSheets } from "../src/context/HomeSheetsProvider";
import { useCitiesQuery, useUnreadCountSync } from "../src/lib/queries";
import { configureNotificationHandler, onNotificationTap } from "../src/lib/push";
import { requestTrackingConsent } from "../src/lib/trackingConsent";
import { BottomTabBar } from "../src/components/home/BottomTabBar";
import { ErrorBoundary } from "../src/components/ErrorBoundary";
import { SoftNavAppPageViews } from "../src/components/home/SoftNavAppPageViews";
import { reportClientError } from "../src/lib/bffClient";

const queryClient = new QueryClient();

// Once, at module load — decides how a push behaves while the app is foregrounded. A no-op if
// the notifications native module isn't in this binary (see push.ts).
configureNotificationHandler();

// Catches the class of crash ErrorBoundary structurally cannot: a throw outside any render (an
// event handler, an async callback) — same limitation as web's error.tsx not catching
// window.onerror. Set once at module load, before anything else can throw. Re-invokes whatever
// default handler RN/Expo already installed (captured first) so the app's existing crash/restart
// behavior — including the native red-screen in dev — is unchanged; this only adds a report. See
// docs/plans/client-error-reporting-loki-grafana.md.
const rnErrorUtils = (globalThis as { ErrorUtils?: ErrorUtils }).ErrorUtils;
const defaultGlobalErrorHandler = rnErrorUtils?.getGlobalHandler();
rnErrorUtils?.setGlobalHandler((error, isFatal) => {
  void reportClientError({ message: error?.message, stack: error?.stack });
  defaultGlobalErrorHandler?.(error, isFatal);
});

/** Bare-minimum fallback — a render crash reaching this boundary means something broke badly
 * enough that reaching for the app's own themed components isn't a safe bet. */
function CrashFallback() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }}>
      <StatusBar style="dark" />
    </View>
  );
}

/** Keeps the unread count live and turns a tapped "new message" notification into a jump to that
 * thread. Lives inside HomeSheetsProvider so it can read the session token. */
function PushBridge() {
  const { accessToken } = useHomeSheets();
  const router = useRouter();

  useUnreadCountSync(accessToken);

  useEffect(
    () =>
      onNotificationTap((target) => {
        if (target.conversationId) {
          router.push(`/messages/${target.conversationId}`);
          return;
        }
        if (target.path) {
          router.push(target.path as never);
        }
      }),
    [router],
  );

  return null;
}

/** Child of HomeSheetsProvider purely so the top-level ErrorBoundary below can attach `userId`
 * (best-effort — null before login, same as every other consumer of useHomeSheets()) to a crash
 * report without lifting that boundary outside the provider that owns it. */
function AppCrashBoundary({ children }: { children: ReactNode }) {
  const { userId } = useHomeSheets();
  return (
    <ErrorBoundary fallback={<CrashFallback />} userId={userId}>
      {children}
    </ErrorBoundary>
  );
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
      <AppCrashBoundary>
        <PushBridge />
        <SoftNavAppPageViews />
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
      </AppCrashBoundary>
    </HomeSheetsProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* Enables the native keyboard-tracking every KeyboardAvoidingView from
          react-native-keyboard-controller (not RN's own) depends on — see that import's own
          comment in each screen for why the switch happened. Independent of @gorhom/bottom-sheet's
          own keyboard handling (its sheets read nothing from this), so it doesn't affect or
          conflict with the login/filter/option sheets already working correctly on both platforms.
          Wrapped as high as the tree allows so every screen can use it. */}
      <KeyboardProvider>
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
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
