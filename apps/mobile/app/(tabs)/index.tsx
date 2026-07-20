import { useRef, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { useRouter } from "expo-router";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import type { HomeCategoryFilter, PropertyTypeFilter } from "@bhavano/types";
import { useAppTheme } from "../../src/theme/ThemeContext";
import { useHomeSheets } from "../../src/context/HomeSheetsProvider";
import { useAreasQuery, useInfiniteListingsQuery } from "../../src/lib/queries";
import { CategoryChips } from "../../src/components/home/CategoryChips";
import { ListingCard } from "../../src/components/home/ListingCard";
import { FilterSheet, EMPTY_FILTERS, activeFilterCount, type AppliedFilters } from "../../src/components/home/FilterSheet";
import { SortSheet, SORT_OPTIONS, type SortValue } from "../../src/components/home/SortSheet";
import { HOME_TABS } from "../../src/components/home/categories";

/** Below this width, `FlatList` renders one column; at/above it, two — comfortably below every
 * iPad's portrait width (744pt+) and above every phone's, including large phones in portrait. */
const WIDE_SCREEN_BREAKPOINT = 700;

export default function HomeScreen() {
  const { colors, theme, toggleTheme } = useAppTheme();
  const { city, openLocationPicker, requireLogin, accessToken } = useHomeSheets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const numColumns = width >= WIDE_SCREEN_BREAKPOINT ? 2 : 1;

  const [category, setCategory] = useState<HomeCategoryFilter>("buy");
  const [propertyType, setPropertyType] = useState<PropertyTypeFilter | undefined>(undefined);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<AppliedFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortValue>("newest");

  const filterSheetRef = useRef<BottomSheetModal>(null);
  const sortSheetRef = useRef<BottomSheetModal>(null);

  const { data: cityAreas = [] } = useAreasQuery(city?.id);
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteListingsQuery(
    {
      homeCategory: category,
      propertyType,
      cityId: city?.id,
      q: query || undefined,
      areaIds: filters.areaIds,
      bedrooms: filters.bedrooms,
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
      furnished: filters.furnished,
      sort,
      limit: 20,
    },
    accessToken,
  );
  const items = data?.pages.flatMap((p) => p.items) ?? [];
  const total = data?.pages[0]?.total ?? 0;
  const categoryLabel = HOME_TABS.find((t) => t.value === category)?.label ?? "Buy";
  const sortLabel = SORT_OPTIONS.find((s) => s.value === sort)?.label ?? "Newest first";
  const filterCount = activeFilterCount(filters);

  // Switching tabs/property-type clears stale filters — a leftover BHK/price selection from
  // House shouldn't silently apply once the user switches to PG (same rule the web app's
  // CategoryTabs already enforces).
  function onSelectCategory(next: HomeCategoryFilter) {
    setCategory(next);
    setPropertyType(undefined);
    setFilters(EMPTY_FILTERS);
  }
  function onSelectPropertyType(next: PropertyTypeFilter | undefined) {
    setPropertyType(next);
    setFilters(EMPTY_FILTERS);
  }

  function onApplyFilters(next: AppliedFilters) {
    setFilters(next);
    filterSheetRef.current?.dismiss();
  }
  function onSelectSort(value: SortValue) {
    setSort(value);
    sortSheetRef.current?.dismiss();
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        // FlatList's numColumns can't change on an already-mounted list without a forced
        // remount — this key makes rotating an iPad (or resizing a split-view window) between
        // 1- and 2-column widths work instead of warning/breaking.
        key={`cols-${numColumns}`}
        numColumns={numColumns}
        columnWrapperStyle={numColumns > 1 ? styles.columnWrapper : undefined}
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 100 }}
        onEndReached={() => hasNextPage && fetchNextPage()}
        onEndReachedThreshold={0.5}
        ListFooterComponent={isFetchingNextPage ? <ActivityIndicator style={{ marginVertical: 20 }} color={colors.green} /> : null}
        renderItem={({ item }) => (
          <View style={numColumns > 1 ? styles.gridItem : styles.singleItem}>
            <ListingCard item={item} cityName={city?.name ?? ""} />
          </View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
        ListHeaderComponent={
          <View>
            <View style={styles.headerTop}>
              <View style={styles.brandRow}>
                <Image source={require("../../assets/logo.png")} style={styles.logoMark} />
                <Text style={{ fontFamily: "serif", fontWeight: "700", fontSize: 19, color: colors.green }}>
                  Bhavano
                </Text>
              </View>
              <View style={styles.brandRow}>
                <Pressable
                  onPress={toggleTheme}
                  style={[styles.iconButton, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
                >
                  <Text style={{ fontSize: 14 }}>{theme === "dark" ? "☀️" : "🌙"}</Text>
                </Pressable>
                <Pressable onPress={requireLogin}>
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14 }}>Login</Text>
                </Pressable>
              </View>
            </View>

            <Pressable
              onPress={openLocationPicker}
              style={[styles.locationButton, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
            >
              <Text style={{ fontSize: 15 }}>📍</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 9.5, color: colors.muted }}>Showing ads near</Text>
                <Text style={{ fontSize: 13.5, fontWeight: "700", color: colors.text }}>
                  {city?.name ?? "Select a city"}
                </Text>
              </View>
              <Text style={{ fontSize: 11, color: colors.muted }}>▾</Text>
            </Pressable>

            <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={{ fontSize: 14, color: colors.muted }}>🔍</Text>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="2BHK in Koramangala, sofa set…"
                placeholderTextColor={colors.muted}
                style={{ flex: 1, paddingVertical: 11, paddingHorizontal: 8, fontSize: 13.5, color: colors.text }}
              />
            </View>

            <View style={{ marginTop: 12 }}>
              <CategoryChips
                active={category}
                onSelect={onSelectCategory}
                activePropertyType={propertyType}
                onSelectPropertyType={onSelectPropertyType}
              />
            </View>

            <View style={styles.filterSortRow}>
              <Pressable
                onPress={() => filterSheetRef.current?.present()}
                style={[styles.pillButton, { backgroundColor: colors.surfaceAlt, borderColor: filterCount > 0 ? colors.green : colors.border }]}
              >
                <Text style={{ fontSize: 13, fontWeight: "700", color: filterCount > 0 ? colors.green : colors.text }}>Filters</Text>
                {filterCount > 0 && (
                  <View style={[styles.badge, { backgroundColor: colors.green }]}>
                    <Text style={{ fontSize: 10, fontWeight: "700", color: colors.onGreen }}>{filterCount}</Text>
                  </View>
                )}
              </Pressable>
              <Pressable
                onPress={() => sortSheetRef.current?.present()}
                style={[styles.pillButton, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
              >
                <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text }} numberOfLines={1}>
                  Sort: {sortLabel}
                </Text>
              </Pressable>
            </View>

            <View style={styles.sectionHeading}>
              <Text style={{ fontFamily: "serif", fontSize: 17, fontWeight: "600", color: colors.text }}>
                {categoryLabel}
              </Text>
              <Text style={{ fontSize: 11.5, color: colors.muted, fontWeight: "600" }}>{total} results</Text>
            </View>
          </View>
        }
      />

      <FilterSheet
        ref={filterSheetRef}
        cityAreas={cityAreas}
        category={category}
        propertyType={propertyType}
        applied={filters}
        onApply={onApplyFilters}
      />
      <SortSheet ref={sortSheetRef} active={sort} onSelect={onSelectSort} />

      {/* TEMP(auth-gate): posting is open without login for now. */}
      <Pressable onPress={() => router.push("/post")} style={[styles.fab, { backgroundColor: colors.gold }]}>
        <Text style={{ color: "#241C0C", fontWeight: "800", fontSize: 13 }}>＋ Post ad</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  logoMark: { width: 30, height: 30, borderRadius: 8 },
  iconButton: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  locationButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginHorizontal: 16,
  },
  filterSortRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginTop: 12,
    gap: 10,
  },
  pillButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexShrink: 1,
  },
  badge: { minWidth: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  sectionHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingHorizontal: 16,
    paddingBottom: 10,
    paddingTop: 14,
  },
  singleItem: { paddingHorizontal: 16 },
  gridItem: { flex: 1 },
  columnWrapper: { gap: 12, paddingHorizontal: 16 },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 16,
    borderRadius: 28,
    paddingVertical: 13,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    shadowColor: "#000",
    shadowOpacity: 0.19,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20,
    elevation: 6,
  },
});
