import { useCallback, useEffect, useRef, useState } from "react";
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
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
/** Where the strip was last scrolled to, shared by every mounted copy of it. */
let lastStripOffset = 0;

function ScrollableRow({
  children,
  contentContainerStyle,
  colors,
  /** The row's own background — defaults to the page background, but the main category row now
   * sits on a distinct `surfaceAlt` band, so its arrow buttons need to blend into that instead or
   * they'd show as a mismatched patch over it. */
  arrowBackground,
  /** x of the chip to bring into view. Requirements and Blog are separate screens, each mounting
   * its own strip at offset 0, so without this their highlighted chip sits off-screen to the
   * right and the strip looks like it jumped back to the start. */
  focusX,
  focusKey,
}: {
  children: React.ReactNode;
  contentContainerStyle?: object;
  colors: { bg: string; textSoft: string };
  arrowBackground?: string;
  focusX?: number;
  /** Changes when the highlighted chip does, so the position is re-applied on every selection. */
  focusKey?: string;
}) {
  const ref = useRef<ScrollView>(null);
  const [viewport, setViewport] = useState(0);
  const [content, setContent] = useState(0);
  const [offset, setOffset] = useState(0);

  const max = Math.max(0, content - viewport);
  // 1px of slack — fractional offsets after a fling otherwise leave a chevron lit at the end.
  const canLeft = offset > 1;
  const canRight = offset < max - 1;

  // Where the person last left the strip — set only by their own scrolling (drag, fling, arrows),
  // never by whatever scroll events a re-render produces, so a layout reset can't overwrite it.
  // Each screen mounts its own strip at offset 0 and every selection re-renders Home's, so on
  // both we put the strip back where it was, and bring the highlighted chip in if it is off-screen.
  const intended = useRef<number | null>(null);
  // The tabs stay mounted when you leave them, so a strip does not remount on coming back — it
  // would keep the offset it had when you left. Each time its screen gains focus, drop that and
  // take the shared position (where the strip was last left, on whichever screen).
  const [focusCount, setFocusCount] = useState(0);
  useFocusEffect(
    useCallback(() => {
      intended.current = null;
      setFocusCount((n) => n + 1);
    }, []),
  );
  useEffect(() => {
    if (viewport === 0 || content === 0) return;
    const limit = Math.max(0, content - viewport);
    let x = Math.min(intended.current ?? lastStripOffset, limit);
    if (focusX !== undefined && (focusX < x || focusX > x + viewport - 140)) x = Math.min(Math.max(0, focusX - 24), limit);
    intended.current = x;
    lastStripOffset = x;
    const apply = () => ref.current?.scrollTo({ x, animated: false });
    apply();
    // A second pass after layout settles: iOS can reset a horizontal list's offset when the list
    // above it re-lays out.
    const t = setTimeout(apply, 60);
    return () => clearTimeout(t);
  }, [focusKey, focusX, viewport, content, focusCount]);

  const remember = (x: number) => {
    intended.current = x;
    lastStripOffset = x;
  };

  const arrow = (side: "left" | "right") => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Scroll categories ${side}`}
      onPress={() => {
        const x = Math.min(Math.max(0, side === "left" ? offset - 160 : offset + 160), max);
        remember(x);
        ref.current?.scrollTo({ x, animated: true });
      }}
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
        onScrollEndDrag={(e: NativeSyntheticEvent<NativeScrollEvent>) => remember(e.nativeEvent.contentOffset.x)}
        onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => remember(e.nativeEvent.contentOffset.x)}
      >
        {children}
      </ScrollView>
      {canLeft && arrow("left")}
      {canRight && arrow("right")}
    </View>
  );
}

/** Top-level categories only. Each tab's own facet (property type, sharing type, condition,
 * service type) is chosen in FilterSheet, not in a second chip row here. */
export function CategoryChips({
  active,
  onSelect,
}: {
  /** A listing category, or the screen this strip is shown on when it is Requirements or Blog —
   * those are their own screens, and show the strip with themselves highlighted. */
  active: HomeTabValue | "requirements" | "blog";
  /** Omit on Requirements/Blog: picking a listing category there goes back to Home with it set. */
  onSelect?: (value: HomeTabValue) => void;
}) {
  const { colors } = useAppTheme();
  const router = useRouter();
  const select = (value: HomeTabValue) => {
    if (onSelect) onSelect(value);
    // `t` makes a repeat pick of the same category still register as a change on Home.
    else router.navigate({ pathname: "/", params: { category: value, t: String(Date.now()) } });
  };
  const [chipX, setChipX] = useState<Record<string, number>>({});
  const trackX = (key: string) => (e: LayoutChangeEvent) => {
    const x = e.nativeEvent.layout.x;
    setChipX((prev) => (prev[key] === x ? prev : { ...prev, [key]: x }));
  };
  const chipStyle = (on: boolean) => ({
    backgroundColor: on ? colors.green : "transparent",
    borderBottomColor: on ? colors.gold : "transparent",
  });
  const chipText = (on: boolean) => ({ color: on ? colors.onGreen : colors.textSoft, fontWeight: "700" as const, fontSize: 12.5 });

  return (
    <View>
      {/* A distinct band (matching the web app's `CategoryTabs` strip) rather than blending into
       * whatever sits above/below it — the active tab's own green + gold-underline treatment
       * reads clearly against this, the way it wouldn't sitting directly on the page background. */}
      <View style={[styles.tabStrip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
        <ScrollableRow colors={colors} contentContainerStyle={styles.row} arrowBackground={colors.surfaceAlt} focusX={chipX[active]} focusKey={active}>
          {HOME_TABS.map((tab) => {
            const isActive = tab.value === active;
            return (
              <Pressable
                key={tab.value}
                onLayout={trackX(tab.value)}
                onPress={() => select(tab.value)}
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
          {/* Not a `HomeTabValue` — tapping it never filters this feed, it leaves it. Requirements
            * is its own screen (its own feed, its own eligibility gating for non-owners/agents),
            * open to everyone the same way PG/Furniture/Interiors are rather than a bottom-tab
            * gated on looking like an owner/agent. See
            * docs/plans/requirements-feed-for-owners-agents.md. */}
          <Pressable
            onLayout={trackX("requirements")}
            onPress={() => active !== "requirements" && router.navigate("/requirements")}
            style={[styles.chip, chipStyle(active === "requirements")]}
          >
            <Icon name="requirements" size={15} color={active === "requirements" ? colors.onGreen : colors.textSoft} />
            <Text style={chipText(active === "requirements")}>Requirements</Text>
          </Pressable>
          {/* Same idea as Requirements: leaves the feed rather than filtering it. Also reachable
            * from the drawer, but that is easy to miss on a phone. */}
          <Pressable
            onLayout={trackX("blog")}
            onPress={() => active !== "blog" && router.navigate("/blog")}
            style={[styles.chip, chipStyle(active === "blog")]}
          >
            <Icon name="blog" size={15} color={active === "blog" ? colors.onGreen : colors.textSoft} />
            <Text style={chipText(active === "blog")}>Blog</Text>
          </Pressable>
        </ScrollableRow>
      </View>
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
});
