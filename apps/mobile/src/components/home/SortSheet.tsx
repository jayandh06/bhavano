import { forwardRef } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { useAppTheme } from "../../theme/ThemeContext";

export type SortValue = "newest" | "price_asc" | "price_desc" | "popular";

export const SORT_OPTIONS: { value: SortValue; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "popular", label: "Most viewed" },
];

/** Single-choice, so tapping an option both applies it and closes the sheet — unlike
 * FilterSheet's multi-field Apply step, there's nothing to batch here. */
export const SortSheet = forwardRef<
  BottomSheetModal,
  { active: SortValue; onSelect: (value: SortValue) => void }
>(function SortSheet({ active, onSelect }, ref) {
  const { colors } = useAppTheme();

  return (
    <BottomSheetModal ref={ref} snapPoints={["40%"]} backgroundStyle={{ backgroundColor: colors.surface }}>
      <BottomSheetView style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>Sort by</Text>
        {SORT_OPTIONS.map((opt) => (
          <Pressable
            key={opt.value}
            onPress={() => onSelect(opt.value)}
            style={[styles.row, opt.value === active && { backgroundColor: colors.surfaceAlt }]}
          >
            <Text style={{ fontSize: 14.5, fontWeight: opt.value === active ? "700" : "500", color: opt.value === active ? colors.green : colors.text }}>
              {opt.label}
            </Text>
            {opt.value === active && <Text style={{ color: colors.green, fontWeight: "700" }}>✓</Text>}
          </Pressable>
        ))}
      </BottomSheetView>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  title: { fontWeight: "700", fontSize: 19, marginBottom: 12 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
});
