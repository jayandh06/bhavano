import type { BlogPost } from "@/lib/blog/posts";
import { COVER_VIEWBOX, coverFor, type CoverShape, type CoverTone } from "@bhavano/types/blogCovers";

/** The picture for a blog article: its real photograph when it has one, otherwise the drawn cover
 * (inline SVG, nothing to download). Server-rendered, so it is in the page's HTML for crawlers.
 *
 * `decorative` is for a list card, where the title right beside it already says what the article is
 * about, so a screen reader should skip the picture rather than read the same thing twice. */
export function BlogCover({
  post,
  className,
  decorative = false,
  eager = false,
}: {
  post: Pick<BlogPost, "slug" | "cover">;
  className?: string;
  decorative?: boolean;
  /** The first picture on a page: load it at once instead of lazily. */
  eager?: boolean;
}) {
  if (post.cover) {
    return (
      // A plain img on purpose: the file is already sized to 1200 by 630 and served from /public.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={post.cover.src}
        alt={decorative ? "" : post.cover.alt}
        width={1200}
        height={630}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        className={`block w-full h-auto object-cover ${className ?? ""}`}
      />
    );
  }

  const scene = coverFor(post);
  const color = (tone: CoverTone | undefined) => (tone ? scene.palette[tone] : "none");
  return (
    <svg
      viewBox={COVER_VIEWBOX}
      className={`block w-full h-auto ${className ?? ""}`}
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": scene.alt })}
    >
      {scene.shapes.map((shape, i) => (
        <Shape key={i} shape={shape} color={color} />
      ))}
    </svg>
  );
}

function Shape({ shape, color }: { shape: CoverShape; color: (tone: CoverTone | undefined) => string }) {
  const common = { opacity: shape.o };
  switch (shape.t) {
    case "rect":
      return (
        <rect
          x={shape.x}
          y={shape.y}
          width={shape.w}
          height={shape.h}
          rx={shape.r}
          fill={color(shape.fill)}
          stroke={shape.stroke ? color(shape.stroke) : undefined}
          strokeWidth={shape.stroke ? (shape.sw ?? 1) : undefined}
          {...common}
        />
      );
    case "circle":
      return (
        <circle
          cx={shape.cx}
          cy={shape.cy}
          r={shape.r}
          fill={color(shape.fill)}
          stroke={shape.stroke ? color(shape.stroke) : undefined}
          strokeWidth={shape.stroke ? (shape.sw ?? 1) : undefined}
          {...common}
        />
      );
    case "ellipse":
      return <ellipse cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} fill={color(shape.fill)} {...common} />;
    case "poly":
      return <polygon points={shape.pts} fill={color(shape.fill)} {...common} />;
    case "path":
      return (
        <path
          d={shape.d}
          fill={color(shape.fill)}
          stroke={shape.stroke ? color(shape.stroke) : undefined}
          strokeWidth={shape.stroke ? (shape.sw ?? 1) : undefined}
          strokeLinecap="round"
          strokeLinejoin="round"
          {...common}
        />
      );
  }
}
