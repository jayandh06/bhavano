import type { ListingCategory } from "./index";

export type ThemeName = "light" | "dark";

export interface ThemeColors {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textSoft: string;
  muted: string;
  green: string;
  onGreen: string;
  gold: string;
}

export const themeColors: Record<ThemeName, ThemeColors> = {
  light: {
    bg: "#FBF7F0",
    surface: "#FFFFFF",
    surfaceAlt: "#F1EBDC",
    border: "#E7DFCE",
    text: "#1c1c1a",
    textSoft: "#4a463d",
    muted: "#8a8478",
    green: "#0B3D2E",
    onGreen: "#EFE9DC",
    gold: "#C9A15A",
  },
  dark: {
    bg: "#14140F",
    surface: "#1E1E17",
    surfaceAlt: "#262619",
    border: "#37372A",
    text: "#EDEAE0",
    textSoft: "#C9C4B4",
    muted: "#9A9483",
    green: "#3FA980",
    onGreen: "#0E1710",
    gold: "#D9B36B",
  },
};

/** Fixed (non-themed) colors used across both themes. */
export const fixedColors = {
  toastBg: "#242420",
  toastText: "#F5F1E6",
  modalScrim: "rgba(0,0,0,0.33)",
  imageCaptionOverlayBg: "rgba(0,0,0,0.19)",
  imageCaptionOverlayText: "rgba(255,255,255,0.8)",
  heartButtonBg: "rgba(255,255,255,0.93)",
};

export const fonts = {
  serif: "Lora",
  sans: "Manrope",
};

export const fontSizes = {
  h1: 26,
  wordmarkDesktop: 24,
  wordmarkMobile: 19,
  priceDesktop: 20,
  priceMobile: 17,
  titleLg: 17,
  titleMd: 15,
  titleSm: 14,
  body: 13.5,
  caption: 12,
  meta: 11,
  chipMobile: 10.5,
};

/** Base spacing scale (px), matching the ~2px-increment spacing observed in the design. */
export const spacing = [4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32] as const;

export const radii = {
  control: 8, // 6-10px on buttons/inputs/chips
  card: 16,
  modalSheet: 20,
  pill: 9999,
};

export const shadows = {
  floating: "0 8px 20px rgba(0,0,0,0.19)",
};

/** Per-category placeholder image colors + label, used until a listing has real photos. */
export const categoryImagePlaceholder: Record<
  ListingCategory,
  { imgA: string; imgB: string; imgLabel: string }
> = {
  house: { imgA: "#D8CBA8", imgB: "#C7B78C", imgLabel: "photo: house exterior" },
  apartment: { imgA: "#CFC2B0", imgB: "#B9A98D", imgLabel: "photo: living room" },
  pg: { imgA: "#C9BFA5", imgB: "#B3A681", imgLabel: "photo: PG room" },
  storage: { imgA: "#C2C2B8", imgB: "#A9A99A", imgLabel: "photo: storage space" },
  coworking: { imgA: "#BFCBC2", imgB: "#A3B4A8", imgLabel: "photo: coworking desk" },
  furniture: { imgA: "#D6C6B3", imgB: "#C2AC90", imgLabel: "photo: furniture item" },
};
