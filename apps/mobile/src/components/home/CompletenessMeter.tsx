import { StyleSheet, Text, View } from "react-native";
import type { ListingCompleteness } from "@bhavano/types/categoryFields";
import { useAppTheme } from "../../theme/ThemeContext";

/** "Add 3 more details" — a bar over the optional specifics a buyer filters on. Purely a nudge: it
 * never blocks posting, and the required fields are not part of it. Mirrors web's
 * CompletenessMeter in CategoryFieldsAccordion.tsx. */
export function CompletenessMeter({ completeness }: { completeness: ListingCompleteness }) {
  const { colors } = useAppTheme();
  const { percent, missing } = completeness;
  if (completeness.total === 0) return null;
  return (
    <View style={[styles.box, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>
        {missing.length === 0 ? "Complete listing — nothing left to add" : `Listing ${percent}% complete`}
      </Text>
      <View style={[styles.track, { backgroundColor: colors.border }]}>
        <View style={{ width: `${percent}%`, height: "100%", backgroundColor: colors.green }} />
      </View>
      {missing.length > 0 && (
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 8 }}>
          {missing.length} more {missing.length === 1 ? "detail" : "details"} helps buyers find it. Still blank:{" "}
          {missing.slice(0, 4).join(", ")}
          {missing.length > 4 ? ` and ${missing.length - 4} more` : ""}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: 10, padding: 12, marginTop: 14 },
  track: { height: 6, borderRadius: 3, overflow: "hidden", marginTop: 8 },
});
