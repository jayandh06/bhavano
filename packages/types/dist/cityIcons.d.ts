/** A distinct emoji per city — presentation-only data, same pattern as
 * `categoryImagePlaceholder` in tokens.ts. Shared by web and mobile so the city picker looks
 * consistent everywhere. Keyed by city name (not id, which is DB-generated/opaque). */
export declare const CITY_ICONS: Record<string, string>;
export declare const DEFAULT_CITY_ICON = "\uD83D\uDCCD";
export declare function getCityIcon(cityName: string): string;
