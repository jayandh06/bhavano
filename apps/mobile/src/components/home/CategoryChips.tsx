import { useRef, useState } from "react";
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { PropertyTypeFilter } from "@bhavano/types";
import { useAppTheme } from "../../theme/ThemeContext";
import { Icon } from "../Icon";
import { HOME_TABS, type HomeTabValue } from "./categories";


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
  /** The row's own background — defaults to the page background, but the main category row now
   * sits on a distinct `surfaceAlt` band, so its arrow buttons need to blend into that instead or
   * they'd show as a mismatched patch over it. */
  arrowBackground,
}: {
  children: React.ReactNode;
  contentContainerStyle?: object;
  colors: { bg: string; textSoft: string };
  arrowBackground?: string;
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
      style={[styles.arrow, side === "left" ? { left: 0 } : { right: 0 }, { backgroundColor: arrowBackground ?? colors.bg }]}
    >
      <Icon name={side === "left" ? "chevronLeft" : "chevronRight"} size={18} color={colors.textSoft} />
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
  active: HomeTabValue;
  onSelect: (value: HomeTabValue) => void;
  activePropertyType?: PropertyTypeFilter;
  onSelectPropertyType: (value: PropertyTypeFilter | undefined) => void;
}) {
  const { colors } = useAppTheme();
  const activeTab = HOME_TABS.find((t) => t.value === active) ?? HOME_TABS[0];

  return (
    <View>
      {/* A distinct band (matching the web app's `CategoryTabs` strip) rather than blending into
       * whatever sits above/below it — the active tab's own green + gold-underline treatment
       * reads clearly against this, the way it wouldn't sitting directly on the page background. */}
      <View style={[styles.tabStrip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
        <ScrollableRow colors={colors} contentContainerStyle={styles.row} arrowBackground={colors.surfaceAlt}>
          {HOME_TABS.map((tab) => {
            const isActive = tab.value === active;
            return (
              <Pressable
                key={tab.value}
                onPress={() => onSelect(tab.value)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: isActive ? colors.green : "transparent",
                    borderBottomColor: isActive ? colors.gold : "transparent",
                  },
                ]}
              >
                <Icon name={tab.icon} size={15} color={isActive ? colors.onGreen : colors.textSoft} />
                <Text style={{ color: isActive ? colors.onGreen : colors.textSoft, fontWeight: "700", fontSize: 12.5 }}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollableRow>
      </View>

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
  // No vertical padding here or on `row`/`chip` — the active tab's fill needs to reach the
  // strip's own top/bottom edges to read as "this tab IS the header," not a pill floating inside
  // it with margin on every side.
  tabStrip: { borderTopWidth: 1, borderBottomWidth: 1 },
  row: { gap: 2, paddingHorizontal: 8 },
  arrow: { position: "absolute", top: 0, bottom: 0, width: 30, alignItems: "center", justifyContent: "center", opacity: 0.94 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderBottomWidth: 3,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  subChip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
});
