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
        tabBarActiveTintColor: colors.onChrome,
        tabBarInactiveTintColor: colors.onChromeMuted,
        tabBarStyle: { backgroundColor: colors.chrome, borderTopColor: colors.chrome },
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
