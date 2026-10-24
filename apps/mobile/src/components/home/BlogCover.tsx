import { Image, View } from "react-native";
import Svg, { Circle, Ellipse, Path, Polygon, Rect } from "react-native-svg";
import type { BlogPost } from "@bhavano/types/blogPosts";
import { COVER_RATIO, COVER_VIEWBOX, coverFor, type CoverShape, type CoverTone } from "@bhavano/types/blogCovers";
import { publicWebUrl } from "../../lib/appWebUrl";

/** The picture for a blog article, the same as on the website: its photograph when it has one,
 * otherwise the drawn cover from `@bhavano/types/blogCovers`. `decorative` is for a list row whose
 * title already says what the article is about. */
export function BlogCover({
  post,
  radius = 10,
  decorative = false,
}: {
  post: Pick<BlogPost, "slug" | "cover">;
  radius?: number;
  decorative?: boolean;
}) {
  const scene = post.cover ? null : coverFor(post);
  const label = post.cover?.alt ?? scene?.alt;
  const a11y = decorative
    ? ({ accessible: false, importantForAccessibility: "no-hide-descendants", accessibilityElementsHidden: true } as const)
    : ({ accessible: true, accessibilityRole: "image", accessibilityLabel: label } as const);

  return (
    <View style={{ width: "100%", aspectRatio: COVER_RATIO, borderRadius: radius, overflow: "hidden" }} {...a11y}>
      {post.cover ? (
        <Image source={{ uri: publicWebUrl(post.cover.src) }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
      ) : (
        scene && (
          <Svg viewBox={COVER_VIEWBOX} width="100%" height="100%">
            {scene.shapes.map((shape, i) => (
              <ShapeView key={i} shape={shape} color={(t) => (t ? scene.palette[t] : "none")} />
            ))}
          </Svg>
        )
      )}
    </View>
  );
}

function ShapeView({ shape, color }: { shape: CoverShape; color: (tone: CoverTone | undefined) => string }) {
  const opacity = shape.o;
  switch (shape.t) {
    case "rect":
      return (
        <Rect
          x={shape.x}
          y={shape.y}
          width={shape.w}
          height={shape.h}
          rx={shape.r}
          fill={color(shape.fill)}
          stroke={shape.stroke ? color(shape.stroke) : undefined}
          strokeWidth={shape.stroke ? (shape.sw ?? 1) : undefined}
          opacity={opacity}
        />
      );
    case "circle":
      return (
        <Circle
          cx={shape.cx}
          cy={shape.cy}
          r={shape.r}
          fill={color(shape.fill)}
          stroke={shape.stroke ? color(shape.stroke) : undefined}
          strokeWidth={shape.stroke ? (shape.sw ?? 1) : undefined}
          opacity={opacity}
        />
      );
    case "ellipse":
      return <Ellipse cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} fill={color(shape.fill)} opacity={opacity} />;
    case "poly":
      return <Polygon points={shape.pts} fill={color(shape.fill)} opacity={opacity} />;
    case "path":
      return (
        <Path
          d={shape.d}
          fill={color(shape.fill)}
          stroke={shape.stroke ? color(shape.stroke) : undefined}
          strokeWidth={shape.stroke ? (shape.sw ?? 1) : undefined}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={opacity}
        />
      );
  }
}
