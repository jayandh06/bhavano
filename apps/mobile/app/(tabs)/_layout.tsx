import { Tabs } from "expo-router";

// The bar itself — icons, colors, active-state, and the same login-gating this file used to do
// via screenListeners' tabPress — now lives in BottomTabBar (app/_layout.tsx), rendered outside
// this navigator entirely so it stays visible on screens Tabs doesn't own (a listing, a message
// thread, Purchases, Saved). `Tabs` is kept here purely for its switching semantics — each of
// these four screens keeps its own independent state, and navigating between them re-selects
// rather than pushing a new one onto a stack — with `tabBar={() => null}` so it renders none of
// its own chrome, leaving BottomTabBar as the only one.
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={() => null}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="messages" />
      <Tabs.Screen name="post" />
      <Tabs.Screen name="account" />
    </Tabs>
  );
}
