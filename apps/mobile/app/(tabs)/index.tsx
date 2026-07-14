import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import type { HomeCategoryFilter, PropertyTypeFilter } from "@bhavano/types";
import { useAppTheme } from "../../src/theme/ThemeContext";
import { useHomeSheets } from "../../src/context/HomeSheetsProvider";
import { useListingsQuery } from "../../src/lib/queries";
import { CategoryChips } from "../../src/components/home/CategoryChips";
import { ListingCard } from "../../src/components/home/ListingCard";
import { HOME_TABS } from "../../src/components/home/categories";

export default function HomeScreen() {
  const { colors, theme, toggleTheme } = useAppTheme();
  const { city, openLocationPicker, requireLogin, accessToken } = useHomeSheets();
  const router = useRouter();
  const [category, setCategory] = useState<HomeCategoryFilter>("buy");
  const [propertyType, setPropertyType] = useState<PropertyTypeFilter | undefined>(undefined);
  const [query, setQuery] = useState("");

  const { data } = useListingsQuery(
    {
      homeCategory: category,
      propertyType,
      cityId: city?.id,
      q: query || undefined,
      limit: 20,
    },
    accessToken,
  );
  const categoryLabel = HOME_TABS.find((t) => t.value === category)?.label ?? "Buy";

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={data?.items ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 100 }}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 16 }}>
            <ListingCard item={item} cityName={city?.name ?? ""} />
          </View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
        ListHeaderComponent={
          <View>
            <View style={styles.headerTop}>
              <View style={styles.brandRow}>
                <View style={[styles.logoMark, { backgroundColor: colors.green }]}>
                  <View style={[styles.logoGlyph, { borderColor: colors.gold }]} />
                </View>
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
                onSelect={(next) => {
                  setCategory(next);
                  setPropertyType(undefined);
                }}
                activePropertyType={propertyType}
                onSelectPropertyType={setPropertyType}
              />
            </View>

            <View style={styles.sectionHeading}>
              <Text style={{ fontFamily: "serif", fontSize: 17, fontWeight: "600", color: colors.text }}>
                {categoryLabel}
              </Text>
              <Text style={{ fontSize: 11.5, color: colors.muted, fontWeight: "600" }}>
                {data?.total ?? 0} results
              </Text>
            </View>
          </View>
        }
      />

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
  logoMark: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  logoGlyph: { width: 10, height: 10, borderWidth: 2, borderBottomWidth: 0, borderRadius: 2, transform: [{ rotate: "45deg" }] },
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
  sectionHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingHorizontal: 16,
    paddingBottom: 10,
    paddingTop: 4,
  },
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
