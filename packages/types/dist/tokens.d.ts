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
    /** App chrome — the top status-bar strip and the bottom tab bar. A deliberate high-contrast
     * frame around the warm `bg` content area; the status-bar clock/battery and the tab labels
     * sit on it, so the app forces light status-bar content on both themes. */
    chrome: string;
    onChrome: string;
    onChromeMuted: string;
}
export declare const themeColors: Record<ThemeName, ThemeColors>;
/** Fixed (non-themed) colors used across both themes. */
export declare const fixedColors: {
    toastBg: string;
    toastText: string;
    modalScrim: string;
    imageCaptionOverlayBg: string;
    imageCaptionOverlayText: string;
    heartButtonBg: string;
};
export declare const fonts: {
    serif: string;
    sans: string;
};
export declare const fontSizes: {
    h1: number;
    wordmarkDesktop: number;
    wordmarkMobile: number;
    priceDesktop: number;
    priceMobile: number;
    titleLg: number;
    titleMd: number;
    titleSm: number;
    body: number;
    caption: number;
    meta: number;
    chipMobile: number;
};
/** Base spacing scale (px), matching the ~2px-increment spacing observed in the design. */
export declare const spacing: readonly [4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32];
export declare const radii: {
    control: number;
    card: number;
    modalSheet: number;
    pill: number;
};
export declare const shadows: {
    floating: string;
};
/** Per-category placeholder image colors + label, used until a listing has real photos. */
export declare const categoryImagePlaceholder: Record<ListingCategory, {
    imgA: string;
    imgB: string;
    imgLabel: string;
}>;
