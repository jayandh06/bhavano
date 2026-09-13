import { useEffect, useRef } from "react";
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";
import type { City } from "@bhavano/types";
import { useAppTheme } from "../../theme/ThemeContext";
import { Icon } from "../Icon";
import { HOME_TABS, type HomeTabValue } from "./categories";
import { COLLAPSED_BAR_HEIGHT } from "./CollapsedHeaderBar";

const DRAWER_WIDTH = 300;
const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL ?? "https://bhavano.com";

/**
 * The hamburger drawer opened from `CollapsedHeaderBar` — mirrors the web app's mobile
 * `HeaderDrawer` item-for-item (city, login CTA, Browse category links, Tools, Plans, divider,
 * For Owners, Help, divider, account, divider, Appearance), not just the same idea loosely
 * reimplemented. Two deliberate departures from web, both because native's own navigation already
 * covers the ground differently:
 *  - No internal "Bhavano + ✕" header row — web's drawer doesn't have one either (its own
 *    hamburger button already toggles to a ✕ to close), and neither does the collapsed bar this
 *    opens from.
 *  - Web's account block (Profile/Favourites/Messages/My listings/Saved searches/Logout) maps
 *    onto whatever native actually has a screen for: Profile → the Account tab, Favourites →
 *    `/saved`, Messages → its own tab, Purchase history → `/purchases`. My listings/Saved
 *    searches have no native screen yet, so they're left out rather than linking somewhere that
 *    doesn't exist.
 * Tools/Plans/Help have no native screens, so they open bhavano.com in an in-app browser, same as
 * `UtilityBar`.
 */
export function HomeDrawer({
  visible,
  onClose,
  city,
  onOpenLocationPicker,
  activeCategory,
  onSelectCategory,
  isLoggedIn,
  userName,
  onLogin,
  onLogout,
  theme,
  onToggleTheme,
}: {
  visible: boolean;
  onClose: () => void;
  city: City | null;
  onOpenLocationPicker: () => void;
  activeCategory: HomeTabValue;
  onSelectCategory: (value: HomeTabValue) => void;
  isLoggedIn: boolean;
  /** Null while logged out or before the profile fetch resolves — the header row falls back to a
   * plain "Account" label rather than showing nothing. */
  userName?: string | null;
  onLogin: () => void;
  onLogout: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}) {
  const { colors } = useAppTheme();
  const router = useRouter();
  const { height: windowHeight } = useWindowDimensions();
  // `Modal` renders as its own top-level native overlay, entirely outside the app's own
  // `SafeAreaView` (app/_layout.tsx) — the collapsed bar it opens from sits below that inset
  // without knowing it, but the modal's own content starts at the raw screen edge unless this is
  // added back in explicitly. Without it, the drawer starts `insets.top` pixels too high — behind
  // the status bar and overlapping the bottom of the bar instead of sitting flush below it.
  const insets = useSafeAreaInsets();
  const topOffset = insets.top + COLLAPSED_BAR_HEIGHT;
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;

  useEffect(() => {
    Animated.timing(translateX, {
      toValue: visible ? 0 : -DRAWER_WIDTH,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [visible, translateX]);

  function selectCategory(value: HomeTabValue) {
    onSelectCategory(value);
    onClose();
  }

  function go(path: string) {
    onClose();
    router.push(path as never);
  }

  function openWebsite(path: string) {
    onClose();
    WebBrowser.openBrowserAsync(`${SITE_URL}${path}`);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* Starts below the collapsed bar (not at the very top of the screen) so the bar — and its
        * hamburger, now showing a ✕ — stays visible and tappable above the dimmed page, matching
        * the website's own scrim. */}
      <Pressable style={[styles.scrim, { top: topOffset }]} onPress={onClose} accessibilityLabel="Close menu" />
      <Animated.View
        style={[
          styles.panel,
          { top: topOffset, backgroundColor: colors.surface, borderColor: colors.border, transform: [{ translateX }] },
        ]}
      >
        {/* `maxHeight` (capping at content, not stretching to it) has to live on the ScrollView
          * itself, not just the panel wrapping it — a bare View's `maxHeight` doesn't reliably
          * clip/scroll an unbounded child the way giving the scrollable element its own explicit
          * height cap does. */}
        <ScrollView style={{ maxHeight: windowHeight - topOffset }} contentContainerStyle={styles.content}>
          <Pressable
            onPress={() => {
              onClose();
              onOpenLocationPicker();
            }}
            accessibilityLabel="Change city"
            style={[styles.locationButton, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
          >
            <Icon name="pin" size={16} color={colors.text} />
            <Text style={{ fontSize: 13.5, fontWeight: "700", color: colors.text, flex: 1 }}>
              {city?.name ?? "All cities"}
            </Text>
            <Icon name="chevronDown" size={14} color={colors.muted} />
          </Pressable>

          {/* Logged out: the sign-in CTA sits here, right below the city control, styled like
              Post ad rather than buried as a plain row further down — matches web exactly. */}
          {!isLoggedIn && (
            <Pressable
              onPress={() => {
                onClose();
                onLogin();
              }}
              style={[styles.loginButton, { backgroundColor: colors.green }]}
            >
              <Icon name="user" size={16} color={colors.onGreen} />
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.onGreen }}>Log in / Sign up</Text>
            </Pressable>
          )}

          <Text style={[styles.sectionLabel, { color: colors.muted }]}>Browse</Text>
          {HOME_TABS.map((tab) => (
            <Pressable
              key={tab.value}
              onPress={() => selectCategory(tab.value)}
              style={[styles.navRow, activeCategory === tab.value && { backgroundColor: colors.surfaceAlt }]}
            >
              <Icon name={tab.icon} size={17} color={activeCategory === tab.value ? colors.green : colors.text} />
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "600",
                  color: activeCategory === tab.value ? colors.green : colors.text,
                }}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}

          <Pressable onPress={() => openWebsite("/tools")} style={styles.navRow}>
            <Icon name="calculator" size={17} color={colors.text} />
            <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>Tools</Text>
          </Pressable>
          <Pressable onPress={() => openWebsite("/premium")} style={styles.navRow}>
            <Icon name="sparkles" size={17} color={colors.gold} />
            <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>Plans</Text>
          </Pressable>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <Pressable onPress={() => go("/post")} style={styles.navRow}>
            <Icon name="list" size={17} color={colors.text} />
            <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>For Owners</Text>
          </Pressable>
          <Pressable onPress={() => openWebsite("/help")} style={styles.navRow}>
            <Icon name="help" size={17} color={colors.text} />
            <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>Help</Text>
          </Pressable>

          {isLoggedIn && (
            <>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <Text style={[styles.sectionLabel, { color: colors.muted }]}>Account</Text>
              <View style={styles.nameRow}>
                <View style={[styles.avatar, { backgroundColor: colors.green }]}>
                  <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 15 }}>
                    {userName?.trim().charAt(0).toUpperCase() || <Icon name="user" size={15} color={colors.onGreen} />}
                  </Text>
                </View>
                <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text, flexShrink: 1 }} numberOfLines={1}>
                  {userName ?? "Account"}
                </Text>
              </View>
              <Pressable onPress={() => go("/account")} style={styles.navRow}>
                <Icon name="user" size={17} color={colors.text} />
                <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>Profile</Text>
              </Pressable>
              <Pressable onPress={() => go("/saved")} style={styles.navRow}>
                <Icon name="heart" size={17} color={colors.text} />
                <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>Favourites</Text>
              </Pressable>
              <Pressable onPress={() => go("/messages")} style={styles.navRow}>
                <Icon name="message" size={17} color={colors.text} />
                <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>Messages</Text>
              </Pressable>
              <Pressable onPress={() => go("/purchases")} style={styles.navRow}>
                <Icon name="pack" size={17} color={colors.text} />
                <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>Purchase history</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  onClose();
                  onLogout();
                }}
                style={styles.navRow}
              >
                <Icon name="logout" size={17} color="#c0554b" />
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#c0554b" }}>Log out</Text>
              </Pressable>
            </>
          )}

          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.appearanceRow}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>Appearance</Text>
            <Pressable
              onPress={onToggleTheme}
              style={[styles.iconButton, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
            >
              <Icon name={theme === "dark" ? "sun" : "moon"} size={16} color={colors.text} />
            </Pressable>
          </View>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // `top` on both is set inline (needs `topOffset`, computed from insets — see the component
  // body) rather than here as a plain constant.
  scrim: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.35)" },
  // No `bottom` — an absolutely-positioned view with only `top` set sizes to its content, capped
  // by the `maxHeight` set inline (viewport height minus the bar above it), matching the website's
  // drawer: it follows its content and only scrolls if that would overflow, rather than always
  // stretching to the bottom of the screen. No border-radius/border on the top or left edges —
  // those are flush against the bar above and the screen edge, only the open bottom-right corner
  // (where the drawer's own edge meets the dimmed page) reads as a border.
  panel: {
    position: "absolute",
    left: 0,
    width: DRAWER_WIDTH,
    maxWidth: "84%",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderBottomRightRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 6, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24, gap: 4 },
  iconButton: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  locationButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  loginButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    paddingVertical: 12,
    marginBottom: 12,
  },
  sectionLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 8, paddingVertical: 8, marginBottom: 4 },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  navRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 8, borderRadius: 8 },
  divider: { height: 1, marginVertical: 12 },
  appearanceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8, paddingVertical: 4 },
});
