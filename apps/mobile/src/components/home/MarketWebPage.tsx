import { Pressable, Text } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useAppTheme } from "../../theme/ThemeContext";
import { appWebUrl } from "../../lib/appWebUrl";
import { P, StaticPageLayout } from "./StaticPageLayout";

/** A legal or help screen in a market whose text lives only on the website (the US): one copy to keep correct, instead of India's text or a second
 * native copy. See docs/plans/mobile-market-switch.md (decision 5). */
export function MarketWebPage({ title, path }: { title: string; path: string }) {
  const { colors } = useAppTheme();
  return (
    <StaticPageLayout title={title}>
      <P>This page is on our website.</P>
      <Pressable
        onPress={() => void WebBrowser.openBrowserAsync(appWebUrl(path))}
        accessibilityRole="link"
        style={{ alignSelf: "flex-start", backgroundColor: colors.green, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 12 }}
      >
        <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 14 }}>Open {title}</Text>
      </Pressable>
    </StaticPageLayout>
  );
}
