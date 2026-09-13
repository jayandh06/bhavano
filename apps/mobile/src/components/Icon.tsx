import {
  ArrowLeft,
  ArrowUpDown,
  BatteryCharging,
  Bath,
  Bed,
  BedDouble,
  Bell,
  Bike,
  Briefcase,
  Building2,
  Calculator,
  Camera,
  Car,
  ChartColumn,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Compass,
  CookingPot,
  DoorClosed,
  Droplets,
  Dumbbell,
  Eye,
  Fan,
  FerrisWheel,
  Heart,
  HelpCircle,
  Home,
  Hotel,
  House,
  IndianRupee,
  Key,
  LandPlot,
  Landmark,
  LayoutGrid,
  Lightbulb,
  List,
  LogOut,
  MapPin,
  Menu,
  MessageCircle,
  Moon,
  Package,
  Paintbrush,
  PartyPopper,
  Phone,
  Plus,
  Presentation,
  Printer,
  Refrigerator,
  Rocket,
  Ruler,
  Scale,
  Search,
  ShowerHead,
  Snowflake,
  Sofa,
  Sparkles,
  SquarePlus,
  Star,
  Store,
  Sun,
  Table,
  Tv,
  Video,
  User,
  UtensilsCrossed,
  WashingMachine,
  Waves,
  Wifi,
  X,
  type LucideIcon,
} from "lucide-react-native";
import type { ColorValue } from "react-native";
import { useAppTheme } from "../theme/ThemeContext";

/**
 * One stroke weight, no fill, a colour taken from the call site — the React Native counterpart of
 * `apps/web/src/components/home/Icon.tsx`, sharing its `IconName` vocabulary so the two apps stay
 * in step. These were emoji: a different design system on every OS, unreachable by our styling,
 * and blind to the theme. `lucide-react-native` draws them as `react-native-svg` paths instead.
 *
 * Unlike the web, React Native has no `currentColor`, so `color` defaults to the theme's primary
 * text colour and every non-default use passes an explicit one.
 */
export const ICONS = {
  pin: MapPin,
  eye: Eye,
  heart: Heart,
  message: MessageCircle,
  phone: Phone,
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
  plus: Plus,
  postAd: SquarePlus,
  user: User,
  back: ArrowLeft,
  menu: Menu,
  logout: LogOut,
  list: List,
  help: HelpCircle,

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

  // Posting categories.
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

  // What comes with a furnished place.
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

  // Catalogue-style amenities.
  cctv: Camera,
  lift: ArrowUpDown,
  powerBackup: BatteryCharging,
  waterSupply: Droplets,
  playArea: FerrisWheel,
  gym: Dumbbell,
  swimmingPool: Waves,
  clubHouse: Landmark,

  // PG/coworking amenities block — must stay in step with apps/web's own Icon.tsx (see that
  // file's matching comment); this was missed when those fields were first added there.
  twoWheelerParking: Bike,
  fourWheelerParking: Car,
  internet: Wifi,
  attachedBathroom: Bath,
  ac: Snowflake,
  laundryService: WashingMachine,
  meetingRoomAccess: Presentation,
  printerAccess: Printer,
  pantry: Coffee,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

/** True for a name that arrived as a plain string across a package boundary (e.g. category data
 * in `@bhavano/types`). An unknown name renders nothing rather than throwing. */
export function isIconName(value: string | undefined): value is IconName {
  return value !== undefined && value in ICONS;
}

export function Icon({
  name,
  size = 18,
  color,
  strokeWidth = 1.75,
  /** Fills the shape as well as stroking it — only for the "on" favourite heart, where an
   * outline alone doesn't read at a glance. */
  filled = false,
}: {
  name: IconName;
  size?: number;
  color?: ColorValue;
  strokeWidth?: number;
  filled?: boolean;
}) {
  const { colors } = useAppTheme();
  const Glyph = ICONS[name];
  const resolved = color ?? colors.text;
  // 1.75 rather than lucide's default 2, which reads heavy at the 13-16px this app mostly uses.
  return <Glyph size={size} color={resolved} strokeWidth={strokeWidth} fill={filled ? resolved : "none"} />;
}
