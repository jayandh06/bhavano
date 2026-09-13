import { useEffect, useRef } from "react";
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";
import type { City } from "@bhavano/types";
import { useAppTheme } from "../../theme/ThemeContext";
import { Icon } from "../Icon";
import { HOME_TABS, type HomeTabValue } from "./categories";

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
 *  - Web's full account block (Profile/Favourites/Messages/My listings/Saved searches/Logout) is
 *    a single "Account" row here instead — native already centralizes all of that under its own
 *    Account tab (see index.tsx's own comment on why Login/Messages are the only account-ish
 *    things duplicated outside it), so re-listing every one of those here would just be a second,
 *    redundant path to the same tab. Messages keeps its own row since native (like web) treats it
 *    as the one thing that stays reachable outside the Account tab.
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
  onLogin,
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
  onLogin: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
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
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close menu" />
      <Animated.View
        style={[
          styles.panel,
          { backgroundColor: colors.surface, borderRightColor: colors.border, transform: [{ translateX }] },
        ]}
      >
        {/* Modal content renders outside app/_layout.tsx's SafeAreaView, so the top inset that
          * ancestor normally handles has to be applied explicitly here instead. */}
        <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}>
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
              <Pressable onPress={() => go("/messages")} style={styles.navRow}>
                <Icon name="message" size={17} color={colors.text} />
                <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>Messages</Text>
              </Pressable>
              <Pressable onPress={() => go("/account")} style={styles.navRow}>
                <Icon name="user" size={17} color={colors.text} />
                <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>Account</Text>
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
  scrim: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.35)" },
  panel: { position: "absolute", left: 0, top: 0, bottom: 0, width: DRAWER_WIDTH, borderRightWidth: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 24, gap: 4 },
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
  navRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 8, borderRadius: 8 },
  divider: { height: 1, marginVertical: 12 },
  appearanceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8, paddingVertical: 4 },
});
