import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { annualRatePerSqft, monthlyFromAnnualRate } from "@bhavano/types/priceQualifiers";
import type { AreaUnit } from "@bhavano/types/areaUnit";
import { useAppTheme } from "../../theme/ThemeContext";

/** Mobile counterpart of the web's `AnnualRateInput`: US commercial rent is quoted per square foot per year, and the
 * ad's price is monthly. Typing a rate fills the monthly price; typing a monthly price shows its rate. */
export function AnnualRateInput({
  price,
  area,
  unit,
  onMonthly,
}: {
  price: string;
  area: number;
  unit: AreaUnit;
  onMonthly: (monthly: string) => void;
}) {
  const { colors } = useAppTheme();
  const [typed, setTyped] = useState<string | null>(null);
  const hasArea = area > 0;
  const derived = annualRatePerSqft(Number(price), area, unit);
  const value = typed ?? (derived === null ? "" : derived.toFixed(2));

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.textSoft }]}>Or yearly rate per sq ft ($)</Text>
      <TextInput
        value={value}
        editable={hasArea}
        keyboardType="decimal-pad"
        maxLength={8}
        accessibilityLabel="Yearly rate per square foot in dollars"
        onChangeText={(text) => {
          const next = text.replace(/[^0-9.]/g, "");
          setTyped(next);
          const monthly = monthlyFromAnnualRate(Number(next), area, unit);
          onMonthly(monthly === null ? "" : String(monthly));
        }}
        onBlur={() => setTyped(null)}
        style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface, opacity: hasArea ? 1 : 0.6 }]}
      />
      <Text style={[styles.hint, { color: colors.muted }]}>
        {hasArea ? "Fills the monthly price: rate × area ÷ 12." : "Enter the area first."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 10 },
  label: { fontSize: 12.5, fontWeight: "700", marginBottom: 5 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  hint: { fontSize: 11.5, marginTop: 4 },
});
