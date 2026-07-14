import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { HomeCategoryFilter, PropertyTypeFilter } from "@bhavano/types";
import { useAppTheme } from "../../theme/ThemeContext";
import { HOME_TABS } from "./categories";

export function CategoryChips({
  active,
  onSelect,
  activePropertyType,
  onSelectPropertyType,
}: {
  active: HomeCategoryFilter;
  onSelect: (value: HomeCategoryFilter) => void;
  activePropertyType?: PropertyTypeFilter;
  onSelectPropertyType: (value: PropertyTypeFilter | undefined) => void;
}) {
  const { colors } = useAppTheme();
  const activeTab = HOME_TABS.find((t) => t.value === active) ?? HOME_TABS[0];

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {HOME_TABS.map((tab) => {
          const isActive = tab.value === active;
          return (
            <Pressable
              key={tab.value}
              onPress={() => onSelect(tab.value)}
              style={[
                styles.chip,
                {
                  backgroundColor: isActive ? colors.surfaceAlt : "transparent",
                  borderColor: isActive ? colors.gold : colors.border,
                },
              ]}
            >
              <Text style={{ fontSize: 13 }}>{tab.icon}</Text>
              <Text style={{ color: isActive ? colors.text : colors.textSoft, fontWeight: "700", fontSize: 12.5 }}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {activeTab.propertyTypes.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.row, { paddingTop: 2 }]}>
          <Pressable
            onPress={() => onSelectPropertyType(undefined)}
            style={[styles.subChip, { borderColor: colors.border, backgroundColor: !activePropertyType ? colors.surfaceAlt : "transparent" }]}
          >
            <Text style={{ color: colors.textSoft, fontWeight: "600", fontSize: 11.5 }}>All types</Text>
          </Pressable>
          {activeTab.propertyTypes.map((pt) => (
            <Pressable
              key={pt.value}
              onPress={() => onSelectPropertyType(pt.value)}
              style={[
                styles.subChip,
                { borderColor: colors.border, backgroundColor: activePropertyType === pt.value ? colors.surfaceAlt : "transparent" },
              ]}
            >
              <Text style={{ color: colors.textSoft, fontWeight: "600", fontSize: 11.5 }}>{pt.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingHorizontal: 16, paddingVertical: 2 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  subChip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
});
