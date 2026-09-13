import { useRef, useState } from "react";
import { ActivityIndicator, FlatList, Image, Keyboard, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { useRouter } from "expo-router";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import type { PropertyTypeFilter } from "@bhavano/types";
import { useAppTheme } from "../../src/theme/ThemeContext";
import { useHomeSheets } from "../../src/context/HomeSheetsProvider";
import { useAreasQuery, useInfiniteListingsQuery, useUnreadCountQuery } from "../../src/lib/queries";
import { CategoryChips } from "../../src/components/home/CategoryChips";
import { CollapsedHeaderBar } from "../../src/components/home/CollapsedHeaderBar";
import { HomeDrawer } from "../../src/components/home/HomeDrawer";
import { Icon } from "../../src/components/Icon";
import { ListingCard } from "../../src/components/home/ListingCard";
import { ProfileCompletionBanner } from "../../src/components/home/ProfileCompletionBanner";
import { UtilityBar } from "../../src/components/home/UtilityBar";
import { FilterSheet, EMPTY_FILTERS, activeFilterCount, type AppliedFilters } from "../../src/components/home/FilterSheet";
import { SortSheet, SORT_OPTIONS, type SortValue } from "../../src/components/home/SortSheet";
import { HOME_TABS, type HomeTabValue } from "../../src/components/home/categories";

/** Below this width, `FlatList` renders one column; at/above it, two — comfortably below every
 * iPad's portrait width (744pt+) and above every phone's, including large phones in portrait. */
const WIDE_SCREEN_BREAKPOINT = 700;

export default function HomeScreen() {
  const { colors, theme, toggleTheme } = useAppTheme();
  const { city, openLocationPicker, requireLogin, accessToken, isLoggedIn } = useHomeSheets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const numColumns = width >= WIDE_SCREEN_BREAKPOINT ? 2 : 1;

  const [category, setCategory] = useState<HomeTabValue>("all");
  const [propertyType, setPropertyType] = useState<PropertyTypeFilter | undefined>(undefined);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<AppliedFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortValue>("auto");

  const filterSheetRef = useRef<BottomSheetModal>(null);
  const sortSheetRef = useRef<BottomSheetModal>(null);
  const listRef = useRef<FlatList>(null);

  // Mirrors the web app's mobile collapsed header (see CollapsedHeaderBar) — the rich header
  // above lives inside the list's own ListHeaderComponent and scrolls away with it, so once the
  // user has scrolled well past it this overlay bar (hamburger/search/logo/Post ad) takes over as
  // the always-reachable way back to navigation, without needing to scroll back to the top.
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsedSearchOpen, setCollapsedSearchOpen] = useState(false);
  // The rich header's own search reveal — independent of the collapsed bar's, since only one of
  // the two is ever visible at a time (unscrolled vs scrolled) but each keeps its own open state.
  const [topSearchOpen, setTopSearchOpen] = useState(false);
  const COLLAPSE_THRESHOLD = 80;

  const { data: cityAreas = [] } = useAreasQuery(city?.id);
  const { data: unreadCount = 0 } = useUnreadCountQuery(accessToken);
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteListingsQuery(
    {
      homeCategory: category === "all" ? undefined : category,
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
  const categoryLabel = HOME_TABS.find((t) => t.value === category)?.label ?? "All";
  const sortLabel = SORT_OPTIONS.find((s) => s.value === sort)?.label ?? "Auto";
  const filterCount = activeFilterCount(filters);

  // Switching tabs/property-type clears stale filters — a leftover BHK/price selection from
  // House shouldn't silently apply once the user switches to PG (same rule the web app's
  // CategoryTabs already enforces).
  function onSelectCategory(next: HomeTabValue) {
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

  // Selecting a category from the drawer happens while scrolled well past the top — jump back so
  // the visitor actually sees the (now-filtered) results land, instead of a silent state change
  // somewhere off-screen above them.
  function onSelectCategoryFromDrawer(next: HomeTabValue) {
    onSelectCategory(next);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        ref={listRef}
        onScroll={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          if (y > COLLAPSE_THRESHOLD && !headerCollapsed) setHeaderCollapsed(true);
          else if (y <= COLLAPSE_THRESHOLD && headerCollapsed) {
            setHeaderCollapsed(false);
            setCollapsedSearchOpen(false);
          }
        }}
        scrollEventThrottle={16}
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
            <ListingCard item={item} />
          </View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
        ListHeaderComponent={
          <View>
            <UtilityBar />
            <ProfileCompletionBanner />
            <View style={styles.headerTop}>
              <View style={styles.brandRow}>
                <Image source={require("../../assets/logo.png")} style={styles.logoMark} />
                <Text style={{ fontFamily: "serif", fontWeight: "700", fontSize: 19, color: colors.green }}>
                  Bhavano
                </Text>
              </View>
              <View style={styles.brandRow}>
                {/* Logged-in only: the app's one always-visible route to Messages, with the
                    unread count on it. Messages otherwise lives behind a button in the Account
                    tab, where a count would never be seen. */}
                {isLoggedIn && (
                  <Pressable
                    onPress={() => router.push("/messages")}
                    accessibilityLabel={`Messages${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
                    style={[styles.iconButton, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
                  >
                    <Icon name="message" size={16} color={colors.text} />
                    {unreadCount > 0 && (
                      <View style={[styles.badge, styles.iconBadge, { backgroundColor: colors.green }]}>
                        <Text style={{ fontSize: 10, fontWeight: "700", color: colors.onGreen }}>
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                )}
                {/* Only an invitation to log in — once logged in there is nothing to offer here,
                    since the Account tab already owns profile and sign-out. Leaving it visible
                    made a logged-in user look logged out. */}
                {!isLoggedIn && (
                  <Pressable
                    onPress={() => requireLogin()}
                    style={[styles.loginButton, { borderColor: colors.green }]}
                  >
                    <Text style={{ color: colors.green, fontWeight: "700", fontSize: 13.5 }}>Login</Text>
                  </Pressable>
                )}
                <Pressable
                  onPress={toggleTheme}
                  style={[styles.iconButton, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
                >
                  <Icon name={theme === "dark" ? "sun" : "moon"} size={16} color={colors.text} />
                </Pressable>
              </View>
            </View>

            <View style={styles.secondRow}>
              <Pressable
                onPress={openLocationPicker}
                accessibilityLabel="Change city"
                style={[styles.locationButton, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
              >
                <Icon name="pin" size={14} color={colors.text} />
                <Text style={{ fontSize: 12.5, fontWeight: "700", color: colors.text, flexShrink: 1, minWidth: 0 }} numberOfLines={1}>
                  {city?.name ?? "All cities"}
                </Text>
                <Icon name="chevronDown" size={13} color={colors.muted} />
              </Pressable>
              <Pressable
                onPress={() => setTopSearchOpen((o) => !o)}
                accessibilityLabel={topSearchOpen ? "Close search" : "Search"}
                style={[styles.iconButton, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
              >
                <Icon name={topSearchOpen ? "close" : "search"} size={17} color={colors.text} />
              </Pressable>
              {/* `minWidth` (not just `flex:1`) so the search icon and Post ad always keep some
                  breathing room even when the location button is wide enough to nearly fill the
                  row on its own. */}
              <View style={{ flex: 1, minWidth: 14 }} />
              <Pressable onPress={() => router.push("/post")} style={[styles.postAdButton, { backgroundColor: colors.green }]}>
                <Icon name="postAd" size={15} color={colors.onGreen} />
                <Text style={{ fontSize: 13, fontWeight: "700", color: colors.onGreen }}>Post ad</Text>
              </Pressable>
            </View>

            {/* Only shown on demand — typing already live-filters the list via `query`, so this
                button's job is just to confirm/dismiss the keyboard rather than trigger a fetch
                that's already happening. */}
            {topSearchOpen && (
              <View style={styles.searchBar}>
                <View style={[styles.searchInputWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Icon name="search" size={15} color={colors.muted} />
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    autoFocus
                    placeholder="2BHK in Koramangala, sofa set…"
                    placeholderTextColor={colors.muted}
                    style={{ flex: 1, paddingVertical: 11, paddingHorizontal: 8, fontSize: 13.5, color: colors.text }}
                  />
                </View>
                <Pressable
                  onPress={() => {
                    Keyboard.dismiss();
                    setTopSearchOpen(false);
                  }}
                  style={[styles.searchGoButton, { backgroundColor: colors.green }]}
                >
                  <Text style={{ fontSize: 13, fontWeight: "700", color: colors.onGreen }}>Search</Text>
                </Pressable>
              </View>
            )}

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

      {headerCollapsed && (
        <CollapsedHeaderBar
          searchOpen={collapsedSearchOpen}
          onToggleSearch={() => {
            setCollapsedSearchOpen((o) => !o);
            setMenuOpen(false);
          }}
          onOpenMenu={() => {
            setMenuOpen(true);
            setCollapsedSearchOpen(false);
          }}
          onPostAd={() => router.push("/post")}
          query={query}
          onChangeQuery={setQuery}
        />
      )}

      <HomeDrawer
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        city={city}
        onOpenLocationPicker={openLocationPicker}
        activeCategory={category}
        onSelectCategory={onSelectCategoryFromDrawer}
        isLoggedIn={isLoggedIn}
        onLogin={() => requireLogin()}
        theme={theme}
        onToggleTheme={toggleTheme}
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

      {/* The floating "＋ Post ad" button that used to sit here pushed to the same /post route as
          the ＋ Post tab, and being position:absolute bottom:16 it floated directly above that
          tab — two identical affordances stacked on each other, the upper one covering the last
          row of listings. The tab bar is persistent across every screen, so it is the better
          single home for the action. */}
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
  loginButton: { borderWidth: 1.5, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 14 },
  iconButton: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  secondRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, marginBottom: 12 },
  // Fixed height (not just padding) on all three of these — locationButton/postAdButton hold
  // different content (icon+text+icon vs icon+text) than iconButton's single centered icon, so
  // matching padding alone wouldn't reliably land on the same rendered height the way an explicit
  // shared value does.
  locationButton: {
    // Shrinks (rather than grows) so it doesn't compete with the spacer below for the space that
    // should push Post Ad to the far right — it only takes as much room as its content needs,
    // giving up width to fit if a long city name would otherwise overflow the row.
    flexShrink: 1,
    height: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 10,
    minWidth: 0,
  },
  postAdButton: {
    height: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 14,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  searchGoButton: { borderRadius: 10, paddingVertical: 11, paddingHorizontal: 16 },
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
  iconBadge: { position: "absolute", top: -5, right: -6, borderWidth: 1.5, borderColor: "transparent" },
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
});
