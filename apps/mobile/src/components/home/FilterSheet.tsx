import { forwardRef, useEffect, useRef, useState } from "react";
import { Keyboard, Pressable, StyleSheet, Text, View } from "react-native";
import { BottomSheetModal, BottomSheetScrollView, BottomSheetTextInput } from "@gorhom/bottom-sheet";
import type { BottomSheetScrollViewMethods } from "@gorhom/bottom-sheet";
import type { Area, PropertyTypeFilter } from "@bhavano/types";
import { MAX_BEDROOMS, bedroomLabel } from "@bhavano/types/bedrooms";
import { useAppTheme } from "../../theme/ThemeContext";
import { parseAmount } from "../../lib/priceInput";
import { HOME_TABS, type HomeTabValue } from "./categories";

export interface AppliedFilters {
  /** Empty = no area filter, i.e. the whole city. Note this differs from how the sheet now
   * *displays* it: an empty list shows no rows ticked, rather than every row ticked, so that
   * "Clear all" has a visible result. Same convention as the web AreaFilter. */
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

  // Gorhom's own "interactive" keyboardBehavior only repositions the sheet itself relative to
  // the keyboard — it doesn't scroll *within* the sheet's own ScrollView to bring a focused field
  // into view. That's fine for a field near the top, but PRICE sits below Areas/Property
  // Type/Bedrooms, so once the keyboard opens the fields can be scrolled off past its top edge.
  // Tracking the section's y-offset and driving BottomSheetScrollView's own scrollTo on focus is
  // the direct fix, rather than something that merely pads space (tried first, didn't help: see
  // git history) — nesting react-native-keyboard-controller's KeyboardAwareScrollView here isn't
  // an option either, since it would fight BottomSheetScrollView over the same drag gesture (same
  // reason the area checklist isn't its own ScrollView, above).
  const scrollRef = useRef<BottomSheetScrollViewMethods>(null);
  // Two refs, not one: the PRICE section's own onLayout `y` is relative to its immediate parent
  // — the wrapping Pressable used for tap-outside-to-close-the-areas-expander below — not to the
  // BottomSheetScrollView's content itself. The Pressable's own y (relative to the scroll
  // content) has to be added back in to get a y that scrollTo can actually use.
  const restSectionY = useRef(0);
  const priceSectionY = useRef(0);

  // Re-sync staged state to whatever's actually applied every time the sheet is reopened, so a
  // dismiss-without-Apply (tap outside, swipe down) never leaves stale edits for next time.
  //
  // No area filter is expanded to every area ticked, rather than shown as an empty list: "all of
  // them" is what no filter actually means, and opening on a blank checklist reads as though the
  // city had nothing in it. `apply()` collapses it back to [] so this never counts as an active
  // filter. cityAreas is in the deps because it arrives from a query — seeding against the empty
  // first render would otherwise leave nothing ticked once the real list landed.
  useEffect(() => {
    setStaged({
      ...applied,
      areaIds: applied.areaIds.length > 0 ? applied.areaIds : cityAreas.map((a) => a.id),
    });
    setAreasExpanded(false);
  }, [applied, cityAreas]);

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

  // keyboardType="numeric" already keeps letters off the on-screen keys (see the comment by the
  // inputs below), so digits are the only intentional input — anything else reaching here is a
  // paste or a third-party keyboard, most visibly a plain space. parseAmount already strips
  // spaces before parsing, so the *value* was always fine; only the displayed text showed it.
  function onMinChange(text: string) {
    const digits = text.replace(/\D/g, "");
    setMinText(digits);
    setStaged((prev) => ({ ...prev, minPrice: digits ? parseAmount(digits) : undefined }));
  }
  function onMaxChange(text: string) {
    const digits = text.replace(/\D/g, "");
    setMaxText(digits);
    setStaged((prev) => ({ ...prev, maxPrice: digits ? parseAmount(digits) : undefined }));
  }
  function clearPrice() {
    setMinText("");
    setMaxText("");
    setStaged((prev) => ({ ...prev, minPrice: undefined, maxPrice: undefined }));
  }

  function scrollToPrice() {
    const y = restSectionY.current + priceSectionY.current;
    scrollRef.current?.scrollTo({ y: Math.max(y - 16, 0), animated: true });
  }

  // A fixed setTimeout delay before scrollTo (tried first) still left the fields covered on real
  // devices — the keyboard's own open animation and gorhom's height-driven resize don't run on a
  // fixed schedule, so a guessed delay either fires too early (scrolls before the keyboard has
  // claimed its space, then gets fought over and undone by gorhom's own resize a moment later) or
  // too late. `keyboardDidShow` fires once Android reports the keyboard's final height, which is
  // the actual event to key off rather than a guess. `priceFieldFocused` gates it so this doesn't
  // fire (and yank the scroll position) for a field elsewhere in the sheet.
  const priceFieldFocused = useRef(false);
  function onPriceFieldFocus() {
    priceFieldFocused.current = true;
    // Also fire immediately: switching focus straight from Min to Max never re-triggers
    // keyboardDidShow, since the keyboard was already open and never closed.
    scrollToPrice();
  }
  useEffect(() => {
    const sub = Keyboard.addListener("keyboardDidShow", () => {
      if (priceFieldFocused.current) scrollToPrice();
    });
    return () => sub.remove();
  }, []);

  // Collapsed by default so the sheet opens on a short list of sections rather than a wall of
  // area rows — expands only on tapping the AREAS header itself. Reset to collapsed whenever the
  // sheet reopens (see the resync effect above), so a previous visit's expanded state never
  // carries over.
  const [areasExpanded, setAreasExpanded] = useState(false);
  const [areaQuery, setAreaQuery] = useState("");
  /** Search narrows what is shown, never what "Select all" / "Clear all" act on — those always
   * mean every area in the city, which is why they don't say "these". Same call web makes. */
  const visibleAreas = areaQuery.trim()
    ? cityAreas.filter((a) => a.name.toLowerCase().includes(areaQuery.trim().toLowerCase()))
    : cityAreas;

  const allAreaIds = cityAreas.map((a) => a.id);
  /** Empty now means "none selected" and renders that way. It used to be displayed as
   * *every* area selected, which made the empty state unreachable — deselecting the last chip
   * normalised straight back to [] and every chip lit up again. Same problem web's AreaFilter
   * already fixed by pairing "Select all areas" with "Clear all". An empty set still means no
   * area filter as far as the query is concerned, so clearing shows the whole city. */
  const selectedAreaIds = new Set(staged.areaIds);
  const allAreasSelected = staged.areaIds.length === allAreaIds.length && allAreaIds.length > 0;
  const noAreasSelected = staged.areaIds.length === 0;
  const areaSummary = noAreasSelected
    ? "No areas selected"
    : allAreasSelected
      ? "All areas"
      : `${staged.areaIds.length} of ${allAreaIds.length} selected`;

  function toggleArea(id: string) {
    const next = new Set(selectedAreaIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setStaged((prev) => ({ ...prev, areaIds: [...next] }));
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
    setStaged({ ...EMPTY_FILTERS, areaIds: cityAreas.map((a) => a.id) });
    setMinText("");
    setMaxText("");
  }

  // Dismissal is the caller's job (it already holds the ref) — `onApply` both commits the
  // filters and closes the sheet, e.g. `(next) => { setFilters(next); sheetRef.current?.dismiss(); }`.
  function apply() {
    // Every area ticked is the same search as no area filter, so it is stored as none — otherwise
    // the default state would count as an active filter in the badge and send every id in the
    // city as a query param for no reason.
    onApply({ ...staged, areaIds: allAreasSelected ? [] : staged.areaIds });
  }

  // The keyboard props here, plus BottomSheetTextInput on the price fields below, are what keep
  // those fields visible while typing: a plain TextInput focuses without telling the sheet, so
  // the keyboard slides over a sheet that never moves and covers the value being entered.
  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={["75%"]}
      backgroundStyle={{ backgroundColor: colors.surface }}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
    >
      <BottomSheetScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        onScrollBeginDrag={() => areasExpanded && setAreasExpanded(false)}
      >
        <Text style={[styles.title, { color: colors.text }]}>Filters</Text>

        {cityAreas.length > 1 && (
          <View style={styles.section}>
            {/* Collapsed by default — a city can have a hundred areas, and showing that whole
                checklist unconditionally buried every filter below it. Tapping the header is the
                expander; tapping it again (or scrolling the sheet, or tapping anywhere else in
                the sheet while expanded — see the wrapping Pressable below and
                onScrollBeginDrag) closes it back to this summary row. */}
            <Pressable onPress={() => setAreasExpanded((prev) => !prev)} style={styles.sectionHeaderRow}>
              <View>
                <Text style={[styles.sectionLabel, { color: colors.muted, marginBottom: 2 }]}>AREAS</Text>
                <Text style={{ fontSize: 12.5, color: colors.textSoft }}>{areaSummary}</Text>
              </View>
              <Text style={{ color: colors.green, fontWeight: "700", fontSize: 12.5 }}>
                {areasExpanded ? "Close ▲" : "Change ▾"}
              </Text>
            </Pressable>

            {areasExpanded && (
              <View>
                {/* Both directions, matching web's AreaFilter. Each greys out once it would do
                    nothing, so the pair also reads as a status: which end you are already at. */}
                <View style={[styles.sectionHeaderRow, { marginTop: 10 }]}>
                  <View />
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
                    <Pressable
                      onPress={() => setStaged((prev) => ({ ...prev, areaIds: [...allAreaIds] }))}
                      disabled={allAreasSelected}
                    >
                      <Text
                        style={{
                          color: colors.green,
                          fontWeight: "700",
                          fontSize: 12.5,
                          opacity: allAreasSelected ? 0.4 : 1,
                        }}
                      >
                        Select all
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setStaged((prev) => ({ ...prev, areaIds: [] }))}
                      disabled={noAreasSelected}
                    >
                      <Text
                        style={{
                          color: colors.muted,
                          fontWeight: "700",
                          fontSize: 12.5,
                          opacity: noAreasSelected ? 0.4 : 1,
                        }}
                      >
                        Clear all
                      </Text>
                    </Pressable>
                  </View>
                </View>
                {/* A checklist, not chips. As a wrapped chip grid it is a wall of pills several
                    screens tall with the selected ones distinguished only by tint — hard to
                    scan. Rows read top-to-bottom with an explicit tick, and the search box
                    narrows a long list instead of making you hunt. Deliberately NOT its own
                    ScrollView: nesting one inside the sheet's BottomSheetScrollView makes the
                    two fight over the drag gesture. The outer sheet scrolls, and `maxHeight`
                    keeps the list from pushing the other sections off the end. */}
                {cityAreas.length > 8 && (
                  <BottomSheetTextInput
                    value={areaQuery}
                    onChangeText={setAreaQuery}
                    placeholder={`Search ${cityAreas.length} areas`}
                    placeholderTextColor={colors.muted}
                    style={[styles.areaSearch, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
                  />
                )}
                <View style={[styles.areaList, { borderColor: colors.border }]}>
                  {visibleAreas.length === 0 ? (
                    <Text style={{ color: colors.muted, fontSize: 12.5, paddingVertical: 10, paddingHorizontal: 12 }}>
                      No area matches “{areaQuery.trim()}”.
                    </Text>
                  ) : (
                    visibleAreas.map((area, i) => {
                      const on = selectedAreaIds.has(area.id);
                      return (
                        <Pressable
                          key={area.id}
                          onPress={() => toggleArea(area.id)}
                          style={[styles.areaRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
                        >
                          <Text style={{ fontSize: 13.5, color: colors.text, flex: 1 }}>{area.name}</Text>
                          {on && <Text style={{ color: colors.green, fontSize: 15, fontWeight: "700" }}>✓</Text>}
                        </Pressable>
                      );
                    })
                  )}
                </View>
              </View>
            )}
          </View>
        )}

        {/* Tapping anywhere in the rest of the sheet — a section that isn't itself a touchable,
            not any of the chips/buttons inside it, since those claim the touch first — closes
            the areas expander, standing in for "tap outside to close" without needing precise
            hit-testing against the list's own bounds. */}
        <Pressable
          onPress={() => areasExpanded && setAreasExpanded(false)}
          onLayout={(e) => { restSectionY.current = e.nativeEvent.layout.y; }}
        >
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

        <View style={styles.section} onLayout={(e) => { priceSectionY.current = e.nativeEvent.layout.y; }}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionLabel, { color: colors.muted }]}>PRICE</Text>
            {(minText || maxText) && (
              <Pressable onPress={clearPrice}>
                <Text style={{ color: colors.green, fontWeight: "700", fontSize: 12.5 }}>Clear</Text>
              </Pressable>
            )}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <BottomSheetTextInput
              value={minText}
              onChangeText={onMinChange}
              onFocus={onPriceFieldFocus}
              onBlur={() => { priceFieldFocused.current = false; }}
              placeholder="Min"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
              style={[styles.priceInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
            />
            <Text style={{ color: colors.muted }}>–</Text>
            <BottomSheetTextInput
              value={maxText}
              onChangeText={onMaxChange}
              onFocus={onPriceFieldFocus}
              onBlur={() => { priceFieldFocused.current = false; }}
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
        </Pressable>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  title: { fontWeight: "700", fontSize: 19, marginBottom: 16 },
  section: { marginBottom: 20 },
  areaSearch: { borderWidth: 1, borderRadius: 8, paddingVertical: 9, paddingHorizontal: 12, fontSize: 13.5, marginBottom: 8 },
  areaList: { borderWidth: 1, borderRadius: 9, overflow: "hidden" },
  areaRow: { flexDirection: "row", alignItems: "center", paddingVertical: 11, paddingHorizontal: 12 },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  sectionLabel: { fontSize: 12, fontWeight: "700", marginBottom: 10, letterSpacing: 0.3 },
  wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  priceInput: { flex: 1, borderWidth: 1, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12, fontSize: 14 },
  footerRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  resetButton: { flex: 1, borderWidth: 1.5, borderRadius: 10, paddingVertical: 13, alignItems: "center" },
  applyButton: { flex: 2, borderRadius: 10, paddingVertical: 13, alignItems: "center" },
});
