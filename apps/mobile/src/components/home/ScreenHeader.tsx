import { Text, View } from "react-native";
import { useAppTheme } from "../../theme/ThemeContext";

/** A consistent title bar for tab screens that don't have Home's own rich inline header
 * (Messages, Post Ad, Account) — a bottom-bordered bar with the page's title, pinned above
 * whatever scrolls beneath it, so each tab reads as having an actual header instead of content
 * starting directly under the status bar with a plain floating heading (or, for Post Ad, no
 * heading at all). */
export function ScreenHeader({ title }: { title: string }) {
  const { colors } = useAppTheme();
  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.bg,
      }}
    >
      <Text style={{ fontSize: 19, fontWeight: "700", color: colors.text }}>{title}</Text>
    </View>
  );
}
