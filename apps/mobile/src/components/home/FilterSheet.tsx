import { forwardRef, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import type { Area, PropertyTypeFilter } from "@bhavano/types";
import { MAX_BEDROOMS, bedroomLabel } from "@bhavano/types/bedrooms";
import { useAppTheme } from "../../theme/ThemeContext";
import { parseAmount } from "../../lib/priceInput";
import { HOME_TABS, type HomeTabValue } from "./categories";

export interface AppliedFilters {
  /** Empty = every area selected (no narrowing) — same convention as the web AreaFilter. */
  areaIds: string[];
  /** Empty = every bucket selected (no narrowing) — same convention as web's BhkFilter. */
  bedrooms: number[];
  minPrice?: number;
  maxPrice?: number;
  furnished?: "unfurnished" | "semi" | "furnished";
  /** Buy/Rent & Lease only — used to live in `CategoryChips`' own scrolling sub-chip row, which
   * navigated immediately on tap; now staged here like every other filter, so it only takes
   * effect on Apply along with whatever else changed in the same sheet visit. */
  propertyType?: PropertyTypeFilter;
}

export const EMPTY_FILTERS: AppliedFilters = { areaIds: [], bedrooms: [] };

export function activeFilterCount(f: AppliedFilters): number {
  return (
    (f.areaIds.length > 0 ? 1 : 0) +
    (f.bedrooms.length > 0 ? 1 : 0) +
    (f.minPrice !== undefined || f.maxPrice !== undefined ? 1 : 0) +
    (f.furnished ? 1 : 0) +
    (f.propertyType ? 1 : 0)
  );
}

const BEDROOM_BUCKETS = Array.from({ length: MAX_BEDROOMS }, (_, i) => i + 1);

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
    category: HomeTabValue;
    applied: AppliedFilters;
    onApply: (next: AppliedFilters) => void;
  }
>(function FilterSheet({ cityAreas, category, applied, onApply }, ref) {
  const { colors } = useAppTheme();
  const [staged, setStaged] = useState<AppliedFilters>(applied);

  // Re-sync staged state to whatever's actually applied every time the sheet is reopened, so a
  // dismiss-without-Apply (tap outside, swipe down) never leaves stale edits for next time.
  useEffect(() => setStaged(applied), [applied]);

  // Buy/Rent & Lease only — every other tab's own category is fixed (PG is always "pg", etc.),
  // so there's nothing to pick. Reuses HOME_TABS' own option list rather than a second copy, the
  // same source CategoryChips' now-removed sub-chip row read from for these two tabs.
  const propertyTypeOptions = HOME_TABS.find((t) => t.value === category)?.subFilter.options ?? [];
  const offersPropertyType = category === "buy" || category === "rentLease";

  function selectPropertyType(value: string | undefined) {
    setStaged((prev) => ({ ...prev, propertyType: value as PropertyTypeFilter | undefined }));
  }

  const showBhkAndFurnished = staged.propertyType === "house" || staged.propertyType === "apartment";

  // Free min/max entry, not fixed brackets — matches web's own price filter (BrowseFilterBar.tsx's
  // CustomPriceRange), which dropped brackets there for the same reason: a fixed set of ranges
  // either lands wrong for a category outside what it was tuned for, or a genuine boundary case
  // ("show me under ₹45k") that no bracket happens to land on exactly. Kept as their own strings,
  // not staged.minPrice/maxPrice directly, so "2L" stays visible while typing rather than
  // collapsing to "200000" the instant it parses — same reasoning as web's own min/max boxes.
  const [minText, setMinText] = useState(applied.minPrice !== undefined ? String(applied.minPrice) : "");
  const [maxText, setMaxText] = useState(applied.maxPrice !== undefined ? String(applied.maxPrice) : "");
  useEffect(() => {
    setMinText(applied.minPrice !== undefined ? String(applied.minPrice) : "");
    setMaxText(applied.maxPrice !== undefined ? String(applied.maxPrice) : "");
  }, [applied]);

  const parsedMin = minText.trim() ? parseAmount(minText) : undefined;
  const parsedMax = maxText.trim() ? parseAmount(maxText) : undefined;
  const priceError =
    (minText.trim() && parsedMin === undefined) || (maxText.trim() && parsedMax === undefined)
      ? "Enter an amount like 20000, 20k or 2L"
      : parsedMin !== undefined && parsedMax !== undefined && parsedMin > parsedMax
        ? "Min must be less than max"
        : undefined;

  function onMinChange(text: string) {
    setMinText(text);
    const parsed = text.trim() ? parseAmount(text) : undefined;
    setStaged((prev) => ({ ...prev, minPrice: parsed }));
  }
  function onMaxChange(text: string) {
    setMaxText(text);
    const parsed = text.trim() ? parseAmount(text) : undefined;
    setStaged((prev) => ({ ...prev, maxPrice: parsed }));
  }
  function clearPrice() {
    setMinText("");
    setMaxText("");
    setStaged((prev) => ({ ...prev, minPrice: undefined, maxPrice: undefined }));
  }

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

  function selectFurnished(value: AppliedFilters["furnished"]) {
    setStaged((prev) => ({ ...prev, furnished: value }));
  }

  function reset() {
    setStaged(EMPTY_FILTERS);
    setMinText("");
    setMaxText("");
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

        {offersPropertyType && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.muted }]}>PROPERTY TYPE</Text>
            <View style={styles.wrapRow}>
              <Pressable onPress={() => selectPropertyType(undefined)} style={chipStyle(!staged.propertyType, colors)}>
                <Text style={{ fontSize: 13, color: !staged.propertyType ? colors.green : colors.text }}>All</Text>
              </Pressable>
              {propertyTypeOptions.map((opt) => (
                <Pressable key={opt.value} onPress={() => selectPropertyType(opt.value)} style={chipStyle(staged.propertyType === opt.value, colors)}>
                  <Text style={{ fontSize: 13, color: staged.propertyType === opt.value ? colors.green : colors.text }}>{opt.label}</Text>
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
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionLabel, { color: colors.muted }]}>PRICE</Text>
            {(minText || maxText) && (
              <Pressable onPress={clearPrice}>
                <Text style={{ color: colors.green, fontWeight: "700", fontSize: 12.5 }}>Clear</Text>
              </Pressable>
            )}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TextInput
              value={minText}
              onChangeText={onMinChange}
              placeholder="Min"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
              style={[styles.priceInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
            />
            <Text style={{ color: colors.muted }}>–</Text>
            <TextInput
              value={maxText}
              onChangeText={onMaxChange}
              placeholder="Max"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
              style={[styles.priceInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
            />
          </View>
          {/* parseAmount also accepts web's "20k"/"2L"/"1.5Cr" shorthand, but keyboardType="numeric"
            * shows a pure number pad with no letter keys — unlike web's text input, there's no way
            * to actually type a letter here, so advertising shorthand in this hint would promise
            * something the visible keyboard can't do. */}
          <Text style={{ fontSize: 11.5, color: priceError ? "#c0554b" : colors.muted, marginTop: 6 }}>
            {priceError ?? "One bound is enough."}
          </Text>
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
          <Pressable
            onPress={apply}
            disabled={!!priceError}
            style={[styles.applyButton, { backgroundColor: colors.green, opacity: priceError ? 0.5 : 1 }]}
          >
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
  priceInput: { flex: 1, borderWidth: 1, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12, fontSize: 14 },
  footerRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  resetButton: { flex: 1, borderWidth: 1.5, borderRadius: 10, paddingVertical: 13, alignItems: "center" },
  applyButton: { flex: 2, borderRadius: 10, paddingVertical: 13, alignItems: "center" },
});
