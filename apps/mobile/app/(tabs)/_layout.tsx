import { Tabs } from "expo-router";
import { useAppTheme } from "../../src/theme/ThemeContext";
import { useHomeSheets } from "../../src/context/HomeSheetsProvider";
import { Icon, type IconName } from "../../src/components/Icon";

const TAB_ICONS: Record<string, IconName> = {
  index: "home",
  messages: "message",
  post: "plus",
  account: "user",
};

// Tabs whose screen requires being logged in. Tapping one while logged out used to navigate to
// that (mostly blank) screen first and only then pop the login sheet over it, which read as
// "went to a different, broken-looking page" rather than "asked to log in." Intercepting the tab
// press itself instead prompts login immediately and stays on whichever tab was already active —
// the navigation only actually happens once logged in.
const AUTH_REQUIRED_TABS = new Set(["messages", "post", "account"]);

export default function TabsLayout() {
  const { colors } = useAppTheme();
  const { isLoggedIn, requireLogin } = useHomeSheets();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        // Same green as every button, not the frame's separate `chrome` tone (that one's still
        // used for the top status-bar strip) — text/icon colors follow suit for contrast.
        tabBarActiveTintColor: colors.onGreen,
        tabBarInactiveTintColor: colors.onGreenMuted,
        tabBarStyle: { backgroundColor: colors.green, borderTopColor: colors.green },
        // `color` is the resolved active/inactive tint — pass it straight to the icon so the
        // whole bar shifts together on tab change.
        tabBarIcon: ({ color }) => <Icon name={TAB_ICONS[route.name]} size={20} color={color} />,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "700" },
      })}
      screenListeners={({ route }) => ({
        tabPress: (e) => {
          if (AUTH_REQUIRED_TABS.has(route.name) && !isLoggedIn) {
            e.preventDefault();
            requireLogin();
          }
        },
      })}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="messages" options={{ title: "Messages" }} />
      <Tabs.Screen name="post" options={{ title: "Post Ad" }} />
      <Tabs.Screen name="account" options={{ title: "Account" }} />
    </Tabs>
  );
}
