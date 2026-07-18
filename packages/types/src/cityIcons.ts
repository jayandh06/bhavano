/** A distinct emoji per city — presentation-only data, same pattern as
 * `categoryImagePlaceholder` in tokens.ts. Shared by web and mobile so the city picker looks
 * consistent everywhere. Keyed by city name (not id, which is DB-generated/opaque). */
export const CITY_ICONS: Record<string, string> = {
  // Popular
  Bengaluru: "💻",
  Mumbai: "🎬",
  "Delhi NCR": "🏛️",
  Pune: "🎓",
  Hyderabad: "🕌",
  Chennai: "🏖️",
  Kolkata: "🎨",
  Ahmedabad: "🧵",
  Surat: "💎",
  Jaipur: "🏰",
  Kochi: "⚓",
  Chandigarh: "🌷",
  // Tier 2
  Nagpur: "🍊",
  Indore: "🍛",
  Bhopal: "🏞️",
  Coimbatore: "⚙️",
  Visakhapatnam: "🚢",
  Vijayawada: "🌉",
  Lucknow: "👑",
  Kanpur: "🏭",
  Nashik: "🍇",
  Vadodara: "🎵",
  Rajkot: "🔧",
  Patna: "📚",
  Ranchi: "⛰️",
  Bhubaneswar: "🛕",
  Guwahati: "🦏",
  Mysuru: "🏯",
  Mangaluru: "🌴",
  Thiruvananthapuram: "🌊",
  Kozhikode: "🌶️",
  Madurai: "🕉️",
  Amritsar: "🙏",
  Ludhiana: "🧶",
  Dehradun: "🏔️",
  Raipur: "🌾",
  Panaji: "🏝️",
};

export const DEFAULT_CITY_ICON = "📍";

export function getCityIcon(cityName: string): string {
  return CITY_ICONS[cityName] ?? DEFAULT_CITY_ICON;
}
