import { useEffect } from "react";
import { AppState, Image, Linking, Modal, Platform, Pressable, Text, View } from "react-native";
import * as Application from "expo-application";
import Constants from "expo-constants";
import { useQuery } from "@tanstack/react-query";
import { useAppTheme } from "../theme/ThemeContext";
import { fetchAppVersionSettings } from "../lib/bffClient";
import { STORE_URLS, updateRequirement } from "../lib/appUpdate";

const DEFAULT_MESSAGE = "A newer version of Bhavano is available. Please update to keep using the app.";

async function openStore() {
  if (Platform.OS === "ios") {
    await Linking.openURL(STORE_URLS.ios);
    return;
  }
  // market:// opens the Play Store app straight to the listing; if nothing handles it, the web page.
  try {
    await Linking.openURL(STORE_URLS.android);
  } catch {
    await Linking.openURL(STORE_URLS.androidWeb);
  }
}

/** Blocks the whole app, with no way past it, when the server's minimum version for this platform is
 * higher than the installed one (set in admin → Required app update). Re-checked every time the app
 * returns to the foreground, so coming back from the store without updating lands on this again.
 *
 * Fails open: until the setting loads, or if it can't be fetched, nothing is shown. Only installs
 * that contain this component can show it, so it protects future minimums, not versions older than
 * the one that introduced it. See docs/plans/forced-app-update.md. */
export function UpdateGate() {
  const { colors } = useAppTheme();
  const { data, refetch } = useQuery({
    queryKey: ["app-version"],
    queryFn: fetchAppVersionSettings,
    staleTime: 60_000,
    retry: 1,
  });

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void refetch();
    });
    return () => sub.remove();
  }, [refetch]);

  // The binary's own version, not the JS bundle's: an OTA update never changes it.
  const installed = Application.nativeApplicationVersion ?? Constants.expoConfig?.version;
  const { required, message } = updateRequirement(Platform.OS, installed, data);
  if (!required) return null;

  return (
    // No onRequestClose action: the Android back button must not dismiss it.
    <Modal visible animationType="none" statusBarTranslucent onRequestClose={() => undefined}>
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", padding: 28 }}>
        <Image source={require("../../assets/logo.png")} style={{ width: 72, height: 72, borderRadius: 18, marginBottom: 22 }} />
        <Text style={{ fontFamily: "serif", fontWeight: "700", fontSize: 22, color: colors.text, marginBottom: 10 }}>
          Update required
        </Text>
        <Text style={{ fontSize: 15, lineHeight: 22, color: colors.textSoft, textAlign: "center", marginBottom: 28, maxWidth: 340 }}>
          {message || DEFAULT_MESSAGE}
        </Text>
        <Pressable
          onPress={() => void openStore()}
          accessibilityRole="button"
          style={{ backgroundColor: colors.green, borderRadius: 10, paddingVertical: 14, paddingHorizontal: 40 }}
        >
          <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 16 }}>
            {Platform.OS === "ios" ? "Update on the App Store" : "Update on Google Play"}
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}
