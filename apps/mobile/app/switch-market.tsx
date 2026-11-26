import { Pressable, Text } from "react-native";
import { Redirect, useLocalSearchParams, useRouter, type Href } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { getMarket } from "@bhavano/types/market";
import { useAppTheme } from "../src/theme/ThemeContext";
import { P, StaticPageLayout } from "../src/components/home/StaticPageLayout";
import { marketSwitchEnabled, switchMarket, useMarket } from "../src/lib/market";
import { appRouteFor, parseMarketLink, setPendingLink } from "../src/lib/marketLinks";

/** Where a link to the other market lands: it says so, and offers to switch (on a build that offers both) or to open the page in the browser. */
export default function SwitchMarketScreen() {
  const { url } = useLocalSearchParams<{ url?: string }>();
  const { colors } = useAppTheme();
  const router = useRouter();
  const market = useMarket();
  const link = url ? parseMarketLink(url) : null;
  if (!url || !link) return <Redirect href="/" />;
  // Already there (a new install whose first answer matched the link that opened it): go on to what it points at.
  if (link.market === market.id) return <Redirect href={appRouteFor(link.path) as Href} />;

  const canSwitch = marketSwitchEnabled();
  const other = getMarket(link.market);
  const otherName = other.id === "us" ? "the United States" : other.name;
  const hereName = market.id === "us" ? "the United States" : market.name;

  const button = (label: string, onPress: () => void, filled = false) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={{
        alignSelf: "stretch",
        alignItems: "center",
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: colors.green,
        backgroundColor: filled ? colors.green : "transparent",
        paddingVertical: 12,
      }}
    >
      <Text style={{ color: filled ? colors.onGreen : colors.green, fontWeight: "700", fontSize: 14 }}>{label}</Text>
    </Pressable>
  );

  return (
    <StaticPageLayout title={`Bhavano ${other.name}`}>
      <P>
        This link is for {otherName}. The app is showing {hereName}.
      </P>
      {canSwitch &&
        button(
          `Switch to ${other.name}`,
          () => {
            setPendingLink(url);
            void switchMarket(link.market);
          },
          true,
        )}
      {button("Open in browser", () => void WebBrowser.openBrowserAsync(link.webUrl), !canSwitch)}
      {button(`Stay on ${market.name}`, () => router.replace("/"))}
    </StaticPageLayout>
  );
}
