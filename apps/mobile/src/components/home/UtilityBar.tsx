import { Pressable, StyleSheet, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";
import { useAppTheme } from "../../theme/ThemeContext";

const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL ?? "https://bhavano.com";

/**
 * Mirrors the web app's green utility strip above the main header (For Owners / Tools / Plans /
 * Help). The tagline that sits beside those links on web is left out here — web itself hides that
 * same tagline below its own `sm` breakpoint ("cost a whole line of a small screen to say
 * something a visitor who just tapped an ad does not need"), so a phone-width native screen has
 * no more room for it than phone-width web does.
 *
 * Tools/Plans/Help have no native screens (only the website has those pages), so they open
 * bhavano.com in an in-app browser instead of pushing to a route that doesn't exist. For Owners
 * does have a real destination — it's just the Post flow — so that one navigates natively.
 */
export function UtilityBar() {
  const { colors } = useAppTheme();
  const router = useRouter();

  function openWebsite(path: string) {
    WebBrowser.openBrowserAsync(`${SITE_URL}${path}`);
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.green }]}>
      <Pressable onPress={() => router.push("/post")}>
        <Text style={[styles.link, { color: colors.onGreen }]}>For Owners</Text>
      </Pressable>
      <Pressable onPress={() => openWebsite("/tools")}>
        <Text style={[styles.link, { color: colors.onGreen }]}>Tools</Text>
      </Pressable>
      <Pressable onPress={() => openWebsite("/premium")}>
        <Text style={[styles.link, { color: colors.onGreen }]}>Plans</Text>
      </Pressable>
      <Pressable onPress={() => openWebsite("/help")}>
        <Text style={[styles.link, { color: colors.onGreen }]}>Help</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", justifyContent: "flex-end", gap: 18, paddingHorizontal: 16, paddingVertical: 7 },
  link: { fontSize: 12.5, fontWeight: "600" },
});
