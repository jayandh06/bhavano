import { Pressable, Text, View } from "react-native";
import { usePathname, useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatUnreadCount } from "@bhavano/types/unreadCount";
import { useAppTheme } from "../../theme/ThemeContext";
import { useHomeSheets } from "../../context/HomeSheetsProvider";
import { useUnreadCountQuery } from "../../lib/queries";
import { Icon, type IconName } from "../Icon";
import { setTabBarHeight } from "../../lib/tabBarHeight";

interface TabDef {
  key: string;
  path: Href;
  label: string;
  icon: IconName;
  /** Matches (tabs)/_layout.tsx's old AUTH_REQUIRED_TABS — Post stays reachable logged out,
   * matching the website; its own onSubmit is what prompts login. */
  authRequired?: boolean;
  /** Other root-level routes that should still read as "this tab" — e.g. a pushed listing is
   * reached almost always from Home, and Saved/Purchases are both one tap off Account. */
  alsoActiveOn?: string[];
}

const TABS: TabDef[] = [
  { key: "index", path: "/", label: "Home", icon: "home", alsoActiveOn: ["/listing"] },
  { key: "messages", path: "/messages", label: "Messages", icon: "message", authRequired: true },
  { key: "post", path: "/post", label: "Post Ad", icon: "plus" },
  { key: "account", path: "/account", label: "Account", icon: "user", authRequired: true, alsoActiveOn: ["/saved", "/purchases", "/my-listings", "/my-requirements"] },
];

function isActive(pathname: string, tab: TabDef): boolean {
  const base = String(tab.path);
  if (pathname === base) return true;
  if (base !== "/" && pathname.startsWith(`${base}/`)) return true;
  return (tab.alsoActiveOn ?? []).some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Renders outside the `(tabs)` navigator entirely — a sibling of the root `<Stack>` in
 * `app/_layout.tsx`, always mounted regardless of which screen is showing. `(tabs)/_layout.tsx`
 * hides its own native tab bar (`tabBar={() => null}`) so this is the only one; it still uses
 * `Tabs` internally purely for proper tab *switching* semantics (independent per-tab state,
 * `router.push("/")` reselecting rather than stacking), just with no bar of its own to press.
 *
 * Before this, every screen outside `(tabs)` — a listing, a message thread, Purchases, Saved —
 * covered the Tabs navigator entirely while it was on screen, bar included, because React
 * Navigation only shows a navigator's own chrome while *its* screens are active. Pushing those
 * onto the root Stack instead of nesting each under one tab's own stack (which only helps
 * screens reachable from exactly one tab — see the Messages thread's own fix) hid the bar
 * everywhere else. This bar being a permanent part of the frame, not owned by any one
 * navigator, is what makes it visible on literally every screen instead.
 *
 * The Messages tab reads the shared `["unread"]` query (kept live by `useUnreadCountSync` in
 * `app/_layout.tsx`) and paints a count badge on the icon — same total the OS app-icon badge
 * uses. When Messages moved from a Home-header button into this bar, the header badge was
 * removed but this one was never wired; without it the synced count had nowhere visible to go.
 */
export function BottomTabBar() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { isLoggedIn, requireLogin, accessToken } = useHomeSheets();
  const { data: unreadCount = 0 } = useUnreadCountQuery(accessToken);

  return (
    <View
      onLayout={(e) => setTabBarHeight(e.nativeEvent.layout.height)}
      style={{
        flexDirection: "row",
        backgroundColor: colors.green,
        borderTopWidth: 1,
        borderTopColor: colors.green,
        paddingTop: 8,
        paddingBottom: insets.bottom + 6,
      }}
    >
      {TABS.map((tab) => {
        const active = isActive(pathname, tab);
        const color = active ? colors.onGreen : colors.onGreenMuted;
        const showUnread = tab.key === "messages" && isLoggedIn && unreadCount > 0;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="button"
            accessibilityLabel={
              showUnread ? `${tab.label}, ${formatUnreadCount(unreadCount)} unread` : tab.label
            }
            onPress={() => {
              if (tab.authRequired && !isLoggedIn) {
                requireLogin();
                return;
              }
              router.push(tab.path);
            }}
            style={{ flex: 1, alignItems: "center", gap: 2, paddingVertical: 2 }}
          >
            <View style={{ position: "relative" }}>
              <Icon name={tab.icon} size={20} color={color} />
              {showUnread && (
                <View
                  style={{
                    position: "absolute",
                    top: -6,
                    // Nudge further left when capped at "99+" so the wider pill doesn't clip.
                    right: unreadCount > 99 ? -14 : -10,
                    minWidth: unreadCount > 99 ? 22 : 16,
                    height: 16,
                    borderRadius: 8,
                    paddingHorizontal: 4,
                    alignItems: "center",
                    justifyContent: "center",
                    // Contrast against the green tab chrome — same "attention pill" role as the
                    // web header badge, just inverted so it stays readable on brand green.
                    backgroundColor: colors.onGreen,
                  }}
                >
                  <Text style={{ fontSize: 9, fontWeight: "700", color: colors.green, lineHeight: 11 }}>
                    {formatUnreadCount(unreadCount)}
                  </Text>
                </View>
              )}
            </View>
            <Text style={{ fontSize: 10, fontWeight: "700", color }}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
