import { Pressable, Text } from "react-native";
import type { MarketId } from "@bhavano/types/market";
import { useAppTheme } from "../theme/ThemeContext";

/** How a country is named in the app. */
export const COUNTRY_NAMES: Record<MarketId, { flag: string; name: string }> = {
  in: { flag: "🇮🇳", name: "India" },
  us: { flag: "🇺🇸", name: "United States" },
};

/** One country in a list to pick from. */
export function CountryOption({ id, selected, onPress }: { id: MarketId; selected: boolean; onPress: () => void }) {
  const { colors } = useAppTheme();
  const { flag, name } = COUNTRY_NAMES[id];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={name}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderWidth: 1.5,
        borderRadius: 12,
        borderColor: selected ? colors.green : colors.border,
        backgroundColor: selected ? colors.surfaceAlt : "transparent",
        paddingVertical: 14,
        paddingHorizontal: 14,
      }}
    >
      <Text style={{ fontSize: 22 }}>{flag}</Text>
      <Text style={{ flex: 1, fontSize: 15, fontWeight: "700", color: colors.text }}>{name}</Text>
      {selected && <Text style={{ fontSize: 16, fontWeight: "700", color: colors.green }}>✓</Text>}
    </Pressable>
  );
}
