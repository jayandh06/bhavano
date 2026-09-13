import { Stack } from "expo-router";

/** Nests the conversation list and thread under the Messages tab's own stack, rather than the
 * thread living at the top-level `app/messages/[id].tsx` (a sibling of `(tabs)` entirely). That
 * pushed the thread onto the *root* stack, which swapped out the whole `(tabs)` navigator —
 * bottom tab bar included — for the duration. Nesting it here instead means only this inner
 * stack changes screens; the outer Tabs (and its bar) stay mounted and visible the whole time,
 * matching how every other tab-bar app keeps its bar up while viewing one item's detail. */
export default function MessagesStackLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
