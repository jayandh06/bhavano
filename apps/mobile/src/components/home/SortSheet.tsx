import { forwardRef } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { useAppTheme } from "../../theme/ThemeContext";
import { Icon } from "../Icon";

// "auto" (default) matches the web app's Auto sort — the recent-listings mix + boost-cap (see
// docs/plans/homepage-category-mix-and-boost-page-cap.md). Note this app's own infinite-scroll
// fetch is cursor-based (see bffClient.ts's ListingsQuery.cursor), which ListingsService.list()
// only ever plain-sorts regardless of `sort` — the mix currently only runs for offset-paginated
// callers (the website). So "Auto" behaves identically to "Newest first" here today; it's kept as
// its own option for parity with web and to pick up the mix automatically once mobile's fetch
// moves to offset pagination, without another UI change then.
export type SortValue = "auto" | "newest" | "price_asc" | "price_desc" | "popular";

export const SORT_OPTIONS: { value: SortValue; label: string }[] = [
  { value: "auto", label: "Auto" },
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
            {opt.value === active && <Icon name="check" size={16} color={colors.green} />}
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
