import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { useAppTheme } from "../../theme/ThemeContext";
import { Icon } from "../Icon";

/** A consistent title bar for screens that don't have Home's own rich inline header — the tab
 * screens (Messages, Post Ad, Account) use it bare, and pushed screens (a listing, a
 * conversation, Purchases, Saved) add `onBack`. One header component for both cases so
 * navigation always lives in the same place, styled the same way, rather than mixing the OS-
 * drawn `Stack.Screen` header (a different look per platform) with ad hoc inline "‹ Back" rows
 * that scroll away with the content. */
export function ScreenHeader({
  title,
  onBack,
  right,
}: {
  title: string;
  /** Present only on pushed screens — renders a back chevron before the title. Omit for a root
   * tab screen, which has nothing to go back to. */
  onBack?: () => void;
  /** A single trailing action — e.g. the conversation screen's "View ad" link. */
  right?: ReactNode;
}) {
  const { colors } = useAppTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.bg,
      }}
    >
      {onBack && (
        <Pressable onPress={onBack} hitSlop={8} accessibilityLabel="Go back">
          <Icon name="chevronLeft" size={20} color={colors.text} />
        </Pressable>
      )}
      <Text style={{ flex: 1, fontSize: 19, fontWeight: "700", color: colors.text }} numberOfLines={1}>
        {title}
      </Text>
      {right}
    </View>
  );
}
