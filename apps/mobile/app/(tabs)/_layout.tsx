import { Tabs } from "expo-router";
import { useAppTheme } from "../../src/theme/ThemeContext";
import { Icon, type IconName } from "../../src/components/Icon";

const TAB_ICONS: Record<string, IconName> = {
  index: "home",
  saved: "heart",
  post: "plus",
  account: "user",
};

export default function TabsLayout() {
  const { colors } = useAppTheme();

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
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="saved" options={{ title: "Saved" }} />
      <Tabs.Screen name="post" options={{ title: "Post" }} />
      <Tabs.Screen name="account" options={{ title: "Account" }} />
    </Tabs>
  );
}
