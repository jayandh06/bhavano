import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useAppTheme } from "../../theme/ThemeContext";

/**
 * Mirrors the web app's green utility strip above the main header (For Owners / Tools / Plans /
 * Help). The tagline that sits beside those links on web is left out here — web itself hides that
 * same tagline below its own `sm` breakpoint ("cost a whole line of a small screen to say
 * something a visitor who just tapped an ad does not need"), so a phone-width native screen has
 * no more room for it than phone-width web does.
 *
 * Tools (the six calculators, app/tools) and Plans (app/plans.tsx) are native screens. Help is static FAQ content and
 * now has a real native page (StaticPageLayout); For Owners always did, since it's just the Post
 * flow.
 */
export function UtilityBar() {
  const { colors } = useAppTheme();
  const router = useRouter();

  return (
    <View style={[styles.container, { backgroundColor: colors.green }]}>
      <Pressable onPress={() => router.push("/post?from=utility_bar")}>
        <Text style={[styles.link, { color: colors.onGreen }]}>For Owners</Text>
      </Pressable>
      <Pressable onPress={() => router.push("/tools")}>
        <Text style={[styles.link, { color: colors.onGreen }]}>Tools</Text>
      </Pressable>
      {/* Native (app/plans.tsx) — see docs/plans/ios-app-store-release.md for why Plans earned a native screen. */}
      <Pressable onPress={() => router.push("/plans")}>
        <Text style={[styles.link, { color: colors.onGreen }]}>Plans</Text>
      </Pressable>
      <Pressable onPress={() => router.push("/help")}>
        <Text style={[styles.link, { color: colors.onGreen }]}>Help</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", justifyContent: "flex-end", gap: 18, paddingHorizontal: 16, paddingVertical: 7 },
  link: { fontSize: 12.5, fontWeight: "600" },
});
