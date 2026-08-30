import { useRef, useState } from "react";
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { HomeCategoryFilter, PropertyTypeFilter } from "@bhavano/types";
import { useAppTheme } from "../../theme/ThemeContext";
import { HOME_TABS } from "./categories";


/** A horizontally scrolling row that says so.
 *
 * The chip rows have always scrolled; nothing indicated it. `showsHorizontalScrollIndicator` is
 * false — a bar under the chips reads as a border — and on a phone the last chips simply sit
 * off-screen, so someone can reasonably conclude Buy and Rent are the whole set.
 *
 * The chevron only appears on a side that actually has more, and tapping it scrolls rather than
 * only pointing: a hint you cannot act on is a worse hint. Widths come from onLayout and
 * onContentSizeChange because either can settle last, and the row is only scrollable once both
 * are known.
 */
function ScrollableRow({
  children,
  contentContainerStyle,
  colors,
}: {
  children: React.ReactNode;
  contentContainerStyle?: object;
  colors: { bg: string; textSoft: string };
}) {
  const ref = useRef<ScrollView>(null);
  const [viewport, setViewport] = useState(0);
  const [content, setContent] = useState(0);
  const [offset, setOffset] = useState(0);

  const max = Math.max(0, content - viewport);
  // 1px of slack — fractional offsets after a fling otherwise leave a chevron lit at the end.
  const canLeft = offset > 1;
  const canRight = offset < max - 1;

  const arrow = (side: "left" | "right") => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Scroll categories ${side}`}
      onPress={() => ref.current?.scrollTo({ x: side === "left" ? offset - 160 : offset + 160, animated: true })}
      style={[styles.arrow, side === "left" ? { left: 0 } : { right: 0 }, { backgroundColor: colors.bg }]}
    >
      <Text style={{ color: colors.textSoft, fontSize: 18, fontWeight: "700" }}>{side === "left" ? "‹" : "›"}</Text>
    </Pressable>
  );

  return (
    <View>
      <ScrollView
        ref={ref}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={contentContainerStyle}
        scrollEventThrottle={16}
        onLayout={(e: LayoutChangeEvent) => setViewport(e.nativeEvent.layout.width)}
        onContentSizeChange={(w: number) => setContent(w)}
        onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => setOffset(e.nativeEvent.contentOffset.x)}
      >
        {children}
      </ScrollView>
      {canLeft && arrow("left")}
      {canRight && arrow("right")}
    </View>
  );
}

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
      <ScrollableRow colors={colors} contentContainerStyle={styles.row}>
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
      </ScrollableRow>

      {activeTab.propertyTypes.length > 0 && (
        <ScrollableRow colors={colors} contentContainerStyle={[styles.row, { paddingTop: 2 }]}>
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
        </ScrollableRow>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingHorizontal: 16, paddingVertical: 2 },
  arrow: { position: "absolute", top: 0, bottom: 0, width: 30, alignItems: "center", justifyContent: "center", opacity: 0.94 },
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
