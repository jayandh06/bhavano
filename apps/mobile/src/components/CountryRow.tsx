import { Pressable, Text } from "react-native";
import { useAppTheme } from "../theme/ThemeContext";
import { marketSwitchEnabled, useMarket } from "../lib/market";
import { COUNTRY_NAMES } from "./CountryOption";
import { Icon } from "./Icon";

/** "Country: India" in the drawer and on the Account screen. Nothing on a build that offers one country. */
export function CountryRow({ onPress }: { onPress: () => void }) {
  const { colors } = useAppTheme();
  const market = useMarket();
  if (!marketSwitchEnabled()) return null;
  const { flag, name } = COUNTRY_NAMES[market.id];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Country: ${name}. Change`}
      style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 8, minHeight: 44 }}
    >
      <Text style={{ fontSize: 17 }}>{flag}</Text>
      <Text style={{ flex: 1, fontSize: 14, fontWeight: "600", color: colors.text }}>Country: {name}</Text>
      <Icon name="chevronRight" size={14} color={colors.muted} />
    </Pressable>
  );
}
