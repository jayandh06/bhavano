import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useAppTheme } from "../../theme/ThemeContext";
import { Icon } from "../Icon";

/**
 * Mirrors the web app's mobile collapsed header bar (`MobileHeaderCollapse.tsx`): once the Home
 * feed is scrolled past its own rich inline header (logo/location/search live inside the
 * `FlatList`'s `ListHeaderComponent` and scroll away with it), this overlays a slim, always-
 * reachable bar on top of the list — `[☰] [🔍] logo ··· [Post ad]` — so navigation and posting
 * stay one tap away without scrolling back to the top. Hidden entirely while unscrolled, since
 * the full header already offers everything it does.
 */
export function CollapsedHeaderBar({
  searchOpen,
  onToggleSearch,
  onOpenMenu,
  onPostAd,
  query,
  onChangeQuery,
}: {
  searchOpen: boolean;
  onToggleSearch: () => void;
  onOpenMenu: () => void;
  onPostAd: () => void;
  query: string;
  onChangeQuery: (value: string) => void;
}) {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.bg, borderBottomColor: colors.border }]}>
      <View style={styles.row}>
        <Pressable
          onPress={onOpenMenu}
          accessibilityLabel="Open menu"
          style={[styles.iconButton, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
        >
          <Icon name="menu" size={18} color={colors.text} />
        </Pressable>
        <Pressable
          onPress={onToggleSearch}
          accessibilityLabel={searchOpen ? "Close search" : "Search"}
          style={[styles.iconButton, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
        >
          <Icon name={searchOpen ? "close" : "search"} size={17} color={colors.text} />
        </Pressable>
        <Image source={require("../../../assets/logo.png")} style={styles.logoMark} />
        <View style={{ flex: 1 }} />
        <Pressable onPress={onPostAd} style={[styles.postAdButton, { backgroundColor: colors.green }]}>
          <Icon name="postAd" size={15} color={colors.onGreen} />
          <Text style={{ fontSize: 13, fontWeight: "700", color: colors.onGreen }}>Post ad</Text>
        </Pressable>
      </View>

      {searchOpen && (
        <View style={styles.searchRow}>
          <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Icon name="search" size={15} color={colors.muted} />
            <TextInput
              value={query}
              onChangeText={onChangeQuery}
              autoFocus
              placeholder="2BHK in Koramangala, sofa set…"
              placeholderTextColor={colors.muted}
              style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 8, fontSize: 13.5, color: colors.text }}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // `position:absolute` overlays the top of the FlatList's already-scrolled-past content rather
  // than shifting layout — this only ever appears once the list has scrolled well beyond this
  // height, so there's nothing meaningful left uncovered underneath it. No extra safe-area inset
  // needed here: the root layout (app/_layout.tsx) already reserves the status-bar strip above
  // every screen's content area.
  container: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 20, borderBottomWidth: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 10 },
  iconButton: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  // Matches `iconButton`'s size exactly, not the 26px it briefly diverged to — this row's other
  // elements (hamburger/search) are both 36x36, and a smaller logo read as a mistake beside them.
  logoMark: { width: 36, height: 36, borderRadius: 9 },
  postAdButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  searchRow: { paddingHorizontal: 16, paddingBottom: 10 },
  searchBar: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 10, paddingHorizontal: 12 },
});
