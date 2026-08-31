import {
  Bell,
  Building2,
  Calculator,
  Camera,
  ChartColumn,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Compass,
  Eye,
  Heart,
  Home,
  IndianRupee,
  Key,
  LayoutGrid,
  MapPin,
  MessageCircle,
  Moon,
  PartyPopper,
  Package,
  Paintbrush,
  Rocket,
  Ruler,
  Scale,
  Search,
  Sofa,
  Sparkles,
  Star,
  Sun,
  BedDouble,
  Video,
  X,
  type LucideIcon,
} from "lucide-react";

/**
 * The app's icons: one stroke weight, no fill, `currentColor`.
 *
 * These were emoji. Emoji are a different design system on every platform — Apple's are glossy
 * and three-dimensional, Google's are flat and saturated, Windows' are something else again — so
 * the same page looked like a different product depending on the device, and no amount of styling
 * on our side could reach them. They also ignore the theme completely: a 📍 stays the same
 * primary red on a dark page as on a light one, and sits next to text it can never match.
 *
 * `currentColor` is the whole point of the replacement. An icon now takes the colour of whatever
 * it sits in — muted next to muted text, green inside a green button — and follows the theme
 * without anyone maintaining a second palette.
 *
 * Sized in `em` rather than pixels, so an icon scales with the text beside it instead of needing
 * a size at every call site.
 */
export const ICONS = {
  pin: MapPin,
  eye: Eye,
  heart: Heart,
  message: MessageCircle,
  camera: Camera,
  video: Video,
  search: Search,
  sun: Sun,
  moon: Moon,
  check: Check,
  close: X,
  chevronDown: ChevronDown,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  compass: Compass,
  featured: Star,
  boost: Rocket,
  bell: Bell,
  bed: BedDouble,
  allCities: LayoutGrid,
  celebrate: PartyPopper,
  pack: Package,
  building: Building2,
  // Home-tab and tools vocabulary.
  home: Home,
  key: Key,
  sofa: Sofa,
  paint: Paintbrush,
  sparkles: Sparkles,
  calculator: Calculator,
  chart: ChartColumn,
  ruler: Ruler,
  scale: Scale,
  rupee: IndianRupee,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  className = "",
  /** Fills the shape as well as stroking it — only for the favourite heart, where "on" has to
   * read at a glance and an outline alone does not. */
  filled = false,
  label,
}: {
  name: IconName;
  className?: string;
  filled?: boolean;
  label?: string;
}) {
  const Glyph = ICONS[name];
  return (
    <Glyph
      // 1em wide and tall, so it matches whatever text it sits beside; 1.75 rather than lucide's
      // default 2, which reads heavy at the 13-15px this app mostly uses.
      width="1em"
      height="1em"
      strokeWidth={1.75}
      className={`inline-block shrink-0 align-[-0.125em] ${className}`}
      fill={filled ? "currentColor" : "none"}
      // Decorative by default: almost every icon here sits beside its own label, and a screen
      // reader announcing "map pin Koramangala, Bengaluru" is worse than announcing the text.
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
    />
  );
}
