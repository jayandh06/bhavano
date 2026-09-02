"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CITY_ICON = exports.CITY_ICONS = void 0;
exports.getCityIcon = getCityIcon;
/** A distinct emoji per city — presentation-only data, same pattern as
 * `categoryImagePlaceholder` in tokens.ts. Shared by web and mobile so the city picker looks
 * consistent everywhere. Keyed by city name (not id, which is DB-generated/opaque). */
exports.CITY_ICONS = {
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
exports.DEFAULT_CITY_ICON = "📍";
function getCityIcon(cityName) {
    return exports.CITY_ICONS[cityName] ?? exports.DEFAULT_CITY_ICON;
}
