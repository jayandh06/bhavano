import { memo, useId } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, G, LinearGradient, Path, Pattern, Rect, Stop } from "react-native-svg";
import { TRELLIS_DOTS, TRELLIS_PAINT, TRELLIS_PATH, TRELLIS_SIZE, TRELLIS_STROKE_WIDTH, type TrellisSurface } from "../theme/trellis";
import { useAppTheme } from "../theme/ThemeContext";

/**
 * The trellis background, filling its parent behind everything else in it: put it **first** among a container's children. It takes no
 * touches and is hidden from screen readers.
 *
 * `body` and `band` draw only the pattern, over the container's own colour. `head` also paints its own backdrop, as the website's header
 * does (a fade from the surface colour to the page colour), so it hides the page pattern behind it instead of doubling it.
 */
export const Trellis = memo(function Trellis({ surface }: { surface: TrellisSurface }) {
  const { theme, colors } = useAppTheme();
  const paint = TRELLIS_PAINT[theme][surface];
  // Unique per instance (ids are page-wide on web), without the colons useId adds, which `url(#…)` cannot carry.
  const key = useId().replace(/[^a-zA-Z0-9]/g, "");
  const tileId = `trellis${key}`;
  const fadeId = `trellisFade${key}`;

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id={tileId} x="0" y="0" width={TRELLIS_SIZE} height={TRELLIS_SIZE} patternUnits="userSpaceOnUse">
            <Path d={TRELLIS_PATH} stroke={paint.stroke} strokeWidth={TRELLIS_STROKE_WIDTH} strokeOpacity={paint.strokeOpacity} />
            <G fill={paint.fill} fillOpacity={paint.fillOpacity}>
              {TRELLIS_DOTS.map(([cx, cy, r]) => (
                <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />
              ))}
            </G>
          </Pattern>
          {surface === "head" && (
            <LinearGradient id={fadeId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.surface} />
              <Stop offset="1" stopColor={colors.bg} />
            </LinearGradient>
          )}
        </Defs>
        {surface === "head" && <Rect width="100%" height="100%" fill={`url(#${fadeId})`} />}
        <Rect width="100%" height="100%" fill={`url(#${tileId})`} />
      </Svg>
    </View>
  );
});
