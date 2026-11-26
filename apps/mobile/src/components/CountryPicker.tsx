import { useEffect, useState, useSyncExternalStore } from "react";
import { BackHandler, Platform, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import type { MarketId } from "@bhavano/types/market";
import { useAppTheme } from "../theme/ThemeContext";
import { switchMarket, useMarket } from "../lib/market";
import { closeCountryPicker, isCountryPickerOpen, subscribeCountryPicker } from "../lib/countryPicker";
import { COUNTRY_NAMES, CountryOption } from "./CountryOption";

/** The Country picker, with a confirmation before anything changes. An overlay rather than a native modal, because the drawer that opens it is one
 * and closing a modal while presenting another fails on iOS. */
export function CountryPicker() {
  const open = useSyncExternalStore(subscribeCountryPicker, isCountryPickerOpen, isCountryPickerOpen);
  return open ? <Sheet /> : null;
}

function Sheet() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const market = useMarket();
  const [choice, setChoice] = useState<MarketId>(market.id);
  const changed = choice !== market.id;

  // Android's back button closes the picker. The browser preview has no such button.
  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      closeCountryPicker();
      return true;
    });
    return () => sub.remove();
  }, []);

  function confirm() {
    closeCountryPicker();
    // Nothing on screen belongs to the other country, so start from Home.
    router.replace("/");
    void switchMarket(choice);
  }

  return (
    <View style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, justifyContent: "flex-end" }}>
      <Pressable
        onPress={closeCountryPicker}
        accessibilityLabel="Close"
        style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.45)" }}
      />
      <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 20, paddingBottom: 32, gap: 10 }}>
        <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 4 }}>Country</Text>
        <CountryOption id="in" selected={choice === "in"} onPress={() => setChoice("in")} />
        <CountryOption id="us" selected={choice === "us"} onPress={() => setChoice("us")} />
        {changed && (
          <Text style={{ fontSize: 13, lineHeight: 19, color: colors.textSoft }}>
            The app will show {COUNTRY_NAMES[choice].name} listings. Accounts are separate in each country, so you may need to log in. You can
            switch back at any time.
          </Text>
        )}
        <Pressable
          onPress={changed ? confirm : closeCountryPicker}
          accessibilityRole="button"
          style={{ backgroundColor: colors.green, borderRadius: 10, paddingVertical: 13, alignItems: "center", marginTop: 6 }}
        >
          <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 14 }}>
            {changed ? `Switch to ${COUNTRY_NAMES[choice].name}` : "Done"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
