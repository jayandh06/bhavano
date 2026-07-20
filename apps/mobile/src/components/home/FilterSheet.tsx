import { forwardRef, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import type { Area, HomeCategoryFilter, ListingCategory, PropertyTypeFilter } from "@bhavano/types";
import { PRICE_BOUNDS } from "@bhavano/types/priceBounds";
import { MAX_BEDROOMS, bedroomLabel } from "@bhavano/types/bedrooms";
import { useAppTheme } from "../../theme/ThemeContext";

export interface AppliedFilters {
  /** Empty = every area selected (no narrowing) — same convention as the web AreaFilter. */
  areaIds: string[];
  /** Empty = every bucket selected (no narrowing) — same convention as web's BhkFilter. */
  bedrooms: number[];
  minPrice?: number;
  maxPrice?: number;
  furnished?: "unfurnished" | "semi" | "furnished";
}

export const EMPTY_FILTERS: AppliedFilters = { areaIds: [], bedrooms: [] };

export function activeFilterCount(f: AppliedFilters): number {
  return (
    (f.areaIds.length > 0 ? 1 : 0) +
    (f.bedrooms.length > 0 ? 1 : 0) +
    (f.minPrice !== undefined || f.maxPrice !== undefined ? 1 : 0) +
    (f.furnished ? 1 : 0)
  );
}

const BEDROOM_BUCKETS = Array.from({ length: MAX_BEDROOMS }, (_, i) => i + 1);

interface PriceBracket {
  label: string;
  minPrice?: number;
  maxPrice?: number;
}

/** Same geometric-bracket sizing as web's `priceBracketsFor` — a PG's brackets land in the
 * thousands, a house's in lakhs/crores, without hand-tuning either separately. Kept local rather
 * than shared: lifting it into `@bhavano/types` is only worth it once a third caller needs it. */
function priceBracketsFor(category: ListingCategory, isSale: boolean): PriceBracket[] {
  const bounds = PRICE_BOUNDS[category][isSale ? "sale" : "rental"];
  const low = Math.min(bounds.min * 20, bounds.max);
  const high = Math.min(bounds.min * 200, bounds.max);
  const fmt = (n: number) => (n >= 10_000_000 ? `₹${(n / 10_000_000).toFixed(1)}Cr` : n >= 100_000 ? `₹${(n / 100_000).toFixed(1)}L` : `₹${n.toLocaleString("en-IN")}`);
  return [
    { label: `Under ${fmt(low)}`, maxPrice: low },
    { label: `${fmt(low)} – ${fmt(high)}`, minPrice: low, maxPrice: high },
    { label: `${fmt(high)}+`, minPrice: high },
  ];
}

/** Best-effort mapping from the homepage's tab-grouped category to a real `ListingCategory` +
 * sale/rental flag, purely to size the price quick-picks — not filtering logic (the actual
 * minPrice/maxPrice values sent to the backend are category-agnostic). */
function priceBoundsCategoryFor(category: HomeCategoryFilter, propertyType?: PropertyTypeFilter): { listingCategory: ListingCategory; isSale: boolean } {
  if (category === "buy") return { listingCategory: propertyType ?? "house", isSale: true };
  if (category === "rentLease") return { listingCategory: propertyType ?? "house", isSale: false };
  if (category === "pg") return { listingCategory: "pg", isSale: false };
  if (category === "furniture") return { listingCategory: "furniture", isSale: true };
  return { listingCategory: "interiors", isSale: true };
}

const chipStyle = (active: boolean, colors: ReturnType<typeof useAppTheme>["colors"]) => ({
  borderWidth: 1,
  borderRadius: 8,
  paddingVertical: 8,
  paddingHorizontal: 14,
  backgroundColor: active ? colors.surfaceAlt : colors.surface,
  borderColor: active ? colors.green : colors.border,
});

export const FilterSheet = forwardRef<
  BottomSheetModal,
  {
    cityAreas: Area[];
    category: HomeCategoryFilter;
    propertyType?: PropertyTypeFilter;
    applied: AppliedFilters;
    onApply: (next: AppliedFilters) => void;
  }
>(function FilterSheet({ cityAreas, category, propertyType, applied, onApply }, ref) {
  const { colors } = useAppTheme();
  const [staged, setStaged] = useState<AppliedFilters>(applied);

  // Re-sync staged state to whatever's actually applied every time the sheet is reopened, so a
  // dismiss-without-Apply (tap outside, swipe down) never leaves stale edits for next time.
  useEffect(() => setStaged(applied), [applied]);

  const showBhkAndFurnished = propertyType === "house" || propertyType === "apartment";
  const { listingCategory, isSale } = priceBoundsCategoryFor(category, propertyType);
  const brackets = priceBracketsFor(listingCategory, isSale);

  const allAreaIds = cityAreas.map((a) => a.id);
  const selectedAreaIds = staged.areaIds.length === 0 ? new Set(allAreaIds) : new Set(staged.areaIds);

  function toggleArea(id: string) {
    const next = new Set(selectedAreaIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    if (next.size === 0) return; // keep at least one selected, same as web's AreaFilter
    setStaged((prev) => ({ ...prev, areaIds: next.size === allAreaIds.length ? [] : [...next] }));
  }

  const selectedBedrooms = staged.bedrooms.length === 0 ? new Set(BEDROOM_BUCKETS) : new Set(staged.bedrooms);

  function toggleBedroom(n: number) {
    const next = new Set(selectedBedrooms);
    if (next.has(n)) next.delete(n);
    else next.add(n);
    if (next.size === 0) return;
    setStaged((prev) => ({ ...prev, bedrooms: next.size === BEDROOM_BUCKETS.length ? [] : [...next] }));
  }

  function selectBracket(bracket: PriceBracket | null) {
    setStaged((prev) => ({ ...prev, minPrice: bracket?.minPrice, maxPrice: bracket?.maxPrice }));
  }

  function selectFurnished(value: AppliedFilters["furnished"]) {
    setStaged((prev) => ({ ...prev, furnished: value }));
  }

  function reset() {
    setStaged(EMPTY_FILTERS);
  }

  // Dismissal is the caller's job (it already holds the ref) — `onApply` both commits the
  // filters and closes the sheet, e.g. `(next) => { setFilters(next); sheetRef.current?.dismiss(); }`.
  function apply() {
    onApply(staged);
  }

  return (
    <BottomSheetModal ref={ref} snapPoints={["75%"]} backgroundStyle={{ backgroundColor: colors.surface }}>
      <BottomSheetScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>Filters</Text>

        {cityAreas.length > 1 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionLabel, { color: colors.muted }]}>AREAS</Text>
              <Pressable onPress={() => setStaged((prev) => ({ ...prev, areaIds: [] }))}>
                <Text style={{ color: colors.green, fontWeight: "700", fontSize: 12.5 }}>Select all</Text>
              </Pressable>
            </View>
            <View style={styles.wrapRow}>
              {cityAreas.map((area) => (
                <Pressable key={area.id} onPress={() => toggleArea(area.id)} style={chipStyle(selectedAreaIds.has(area.id), colors)}>
                  <Text style={{ fontSize: 13, color: selectedAreaIds.has(area.id) ? colors.green : colors.text }}>{area.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {showBhkAndFurnished && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.muted }]}>BEDROOMS</Text>
            <View style={styles.wrapRow}>
              {BEDROOM_BUCKETS.map((n) => (
                <Pressable key={n} onPress={() => toggleBedroom(n)} style={chipStyle(selectedBedrooms.has(n), colors)}>
                  <Text style={{ fontSize: 13, color: selectedBedrooms.has(n) ? colors.green : colors.text }}>{bedroomLabel(n)} BHK</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.muted }]}>PRICE</Text>
          <View style={styles.wrapRow}>
            <Pressable
              onPress={() => selectBracket(null)}
              style={chipStyle(staged.minPrice === undefined && staged.maxPrice === undefined, colors)}
            >
              <Text style={{ fontSize: 13, color: staged.minPrice === undefined && staged.maxPrice === undefined ? colors.green : colors.text }}>
                Any
              </Text>
            </Pressable>
            {brackets.map((b) => {
              const active = staged.minPrice === b.minPrice && staged.maxPrice === b.maxPrice;
              return (
                <Pressable key={b.label} onPress={() => selectBracket(b)} style={chipStyle(active, colors)}>
                  <Text style={{ fontSize: 13, color: active ? colors.green : colors.text }}>{b.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {showBhkAndFurnished && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.muted }]}>FURNISHING</Text>
            <View style={styles.wrapRow}>
              {([undefined, "unfurnished", "semi", "furnished"] as const).map((value) => (
                <Pressable key={value ?? "any"} onPress={() => selectFurnished(value)} style={chipStyle(staged.furnished === value, colors)}>
                  <Text style={{ fontSize: 13, color: staged.furnished === value ? colors.green : colors.text }}>
                    {value === undefined ? "Any" : value === "unfurnished" ? "Unfurnished" : value === "semi" ? "Semi-furnished" : "Furnished"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <View style={styles.footerRow}>
          <Pressable onPress={reset} style={[styles.resetButton, { borderColor: colors.border }]}>
            <Text style={{ color: colors.textSoft, fontWeight: "700", fontSize: 14 }}>Reset</Text>
          </Pressable>
          <Pressable onPress={apply} style={[styles.applyButton, { backgroundColor: colors.green }]}>
            <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 14 }}>Apply</Text>
          </Pressable>
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  title: { fontWeight: "700", fontSize: 19, marginBottom: 16 },
  section: { marginBottom: 20 },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  sectionLabel: { fontSize: 12, fontWeight: "700", marginBottom: 10, letterSpacing: 0.3 },
  wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  footerRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  resetButton: { flex: 1, borderWidth: 1.5, borderRadius: 10, paddingVertical: 13, alignItems: "center" },
  applyButton: { flex: 2, borderRadius: 10, paddingVertical: 13, alignItems: "center" },
});
