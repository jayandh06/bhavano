import {
  ArrowUpDown,
  BatteryCharging,
  Bed,
  Bell,
  Briefcase,
  CookingPot,
  DoorClosed,
  Dumbbell,
  Fan,
  Hotel,
  House,
  LandPlot,
  Lightbulb,
  Refrigerator,
  ShowerHead,
  Store,
  Table,
  Tv,
  UtensilsCrossed,
  WashingMachine,
  Building2,
  Calculator,
  Camera,
  ChartColumn,
  Droplets,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Compass,
  Eye,
  FerrisWheel,
  Heart,
  Home,
  IndianRupee,
  Key,
  Landmark,
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
  Waves,
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

  // Posting categories — the tiles on the first step of the wizard.
  catHouse: House,
  catApartment: Building2,
  catVilla: Hotel,
  catPlot: LandPlot,
  catPg: BedDouble,
  catCommercial: Store,
  catCoworking: Briefcase,
  catStorage: Package,
  catFurniture: Sofa,
  catInteriors: Paintbrush,

  // What comes with a furnished place — the counted items on a listing's detail page.
  washingMachine: WashingMachine,
  stove: CookingPot,
  fridge: Refrigerator,
  cupboard: DoorClosed,
  fan: Fan,
  light: Lightbulb,
  bedSingle: Bed,
  tv: Tv,
  geyser: ShowerHead,
  table: Table,
  diningTable: UtensilsCrossed,

  // The catalogue-style amenities generated in categoryFields.ts's amenities block.
  cctv: Camera,
  lift: ArrowUpDown,
  powerBackup: BatteryCharging,
  waterSupply: Droplets,
  playArea: FerrisWheel,
  gym: Dumbbell,
  swimmingPool: Waves,
  clubHouse: Landmark,
} satisfies Record<string, LucideIcon>;

/** Narrows a name that crossed a package boundary as a plain string — `iconName` on the shared
 * category data, which cannot reference this file. An unknown name renders nothing rather than
 * throwing, so a category added to the types package without an icon here degrades to no icon
 * rather than a blank page. */
export function isIconName(value: string | undefined): value is IconName {
  return value !== undefined && value in ICONS;
}

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
