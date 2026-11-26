import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { MarketId } from "@bhavano/types/market";
import { useAppTheme } from "../theme/ThemeContext";
import { chooseFirstMarket } from "../lib/market";
import { CountryOption } from "./CountryOption";

/** Asked once, on a new install whose phone region is the US, with the US picked already. Drawn before the app itself, so it uses no navigation. */
export function FirstMarketChooser() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [choice, setChoice] = useState<MarketId>("us");

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bg,
        justifyContent: "center",
        paddingHorizontal: 24,
        paddingTop: insets.top,
        paddingBottom: insets.bottom + 16,
        gap: 12,
      }}
    >
      <Text style={{ fontFamily: "serif", fontWeight: "700", fontSize: 24, color: colors.text }}>Where are you looking?</Text>
      <Text style={{ fontSize: 14, lineHeight: 20, color: colors.textSoft, marginBottom: 8 }}>
        Bhavano shows homes and listings for one country at a time. You can change this later in your account or the menu.
      </Text>
      <CountryOption id="us" selected={choice === "us"} onPress={() => setChoice("us")} />
      <CountryOption id="in" selected={choice === "in"} onPress={() => setChoice("in")} />
      <Pressable
        onPress={() => chooseFirstMarket(choice)}
        accessibilityRole="button"
        style={{ backgroundColor: colors.green, borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 12 }}
      >
        <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 15 }}>Continue</Text>
      </Pressable>
    </View>
  );
}
