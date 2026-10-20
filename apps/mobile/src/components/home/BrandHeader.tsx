import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useAppTheme } from "../../theme/ThemeContext";
import { useHomeSheets } from "../../context/HomeSheetsProvider";
import { Icon } from "../Icon";
import { ProfileCompletionBanner } from "./ProfileCompletionBanner";
import { UtilityBar } from "./UtilityBar";

/** Home's top block: utility bar, profile banner, the Bhavano wordmark with Login and the theme
 * toggle, then the city picker and Post ad. Shared with Requirements and Blog, which show the
 * same strip of tabs and so need the same header above it to read as one of Home's tabs.
 *
 * `search` is Home-only (it live-filters Home's own listings) — omit it elsewhere and the search
 * icon isn't drawn. */
export function BrandHeader({ search }: { search?: { open: boolean; onToggle: () => void } }) {
  const { colors, theme, toggleTheme } = useAppTheme();
  const { city, openLocationPicker, requireLogin, isLoggedIn } = useHomeSheets();
  const router = useRouter();

  return (
    <View>
      <UtilityBar />
      <ProfileCompletionBanner />
      <View style={styles.headerTop}>
        <View style={styles.brandRow}>
          <Image source={require("../../../assets/logo.png")} style={styles.logoMark} />
          <Text style={{ fontFamily: "serif", fontWeight: "700", fontSize: 19, color: colors.green }}>Bhavano</Text>
        </View>
        <View style={styles.brandRow}>
          {/* Messages has its own bottom tab now (with its own reachable unread state) —
              no need to duplicate a route to it here too. */}
          {/* Only an invitation to log in — once logged in there is nothing to offer here,
              since the Account tab already owns profile and sign-out. Leaving it visible
              made a logged-in user look logged out. */}
          {!isLoggedIn && (
            <Pressable onPress={() => requireLogin()} style={[styles.loginButton, { borderColor: colors.green }]}>
              <Text style={{ color: colors.green, fontWeight: "700", fontSize: 13.5 }}>Login</Text>
            </Pressable>
          )}
          <Pressable
            onPress={toggleTheme}
            style={[styles.iconButton, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
          >
            <Icon name={theme === "dark" ? "sun" : "moon"} size={16} color={colors.text} />
          </Pressable>
        </View>
      </View>

      <View style={styles.secondRow}>
        <Pressable
          onPress={openLocationPicker}
          accessibilityLabel="Change city"
          style={[styles.locationButton, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
        >
          <Icon name="pin" size={14} color={colors.text} />
          <Text style={{ fontSize: 12.5, fontWeight: "700", color: colors.text, flexShrink: 1, minWidth: 0 }} numberOfLines={1}>
            {city?.name ?? "All cities"}
          </Text>
          <Icon name="chevronDown" size={13} color={colors.muted} />
        </Pressable>
        {search && (
          <Pressable
            onPress={search.onToggle}
            accessibilityLabel={search.open ? "Close search" : "Search"}
            style={[styles.iconButton, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
          >
            <Icon name={search.open ? "close" : "search"} size={17} color={colors.text} />
          </Pressable>
        )}
        {/* `minWidth` (not just `flex:1`) so the search icon and Post ad always keep some
            breathing room even when the location button is wide enough to nearly fill the
            row on its own. */}
        <View style={{ flex: 1, minWidth: 14 }} />
        <Pressable onPress={() => router.push("/post")} style={[styles.postAdButton, { backgroundColor: colors.green }]}>
          <Icon name="postAd" size={15} color={colors.onGreen} />
          <Text style={{ fontSize: 13, fontWeight: "700", color: colors.onGreen }}>Post ad</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  logoMark: { width: 30, height: 30, borderRadius: 8 },
  loginButton: { borderWidth: 1.5, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 14 },
  iconButton: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  secondRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, marginBottom: 12 },
  // Fixed height (not just padding) on all three of these — locationButton/postAdButton hold
  // different content (icon+text+icon vs icon+text) than iconButton's single centered icon, so
  // matching padding alone wouldn't reliably land on the same rendered height the way an explicit
  // shared value does.
  locationButton: {
    // Shrinks (rather than grows) so it doesn't compete with the spacer for the space that
    // should push Post Ad to the far right — it only takes as much room as its content needs,
    // giving up width to fit if a long city name would otherwise overflow the row.
    flexShrink: 1,
    height: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 10,
    minWidth: 0,
  },
  postAdButton: {
    height: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 14,
  },
});
