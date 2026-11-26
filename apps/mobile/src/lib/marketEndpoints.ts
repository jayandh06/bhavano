import { getCurrentMarketId } from "./marketState";

/** Each market has its own server and its own place on the website. Ask at the time of the request, never keep the answer in a module constant:
 * the market can change while the app runs. The `process.env.EXPO_PUBLIC_*` names must stay written out in full, which is how Expo inlines them. */

/** The market's BFF. */
export function apiUrl(): string {
  if (getCurrentMarketId() === "us") return process.env.EXPO_PUBLIC_US_BFF_URL || "https://api.us.bhavano.com";
  return process.env.EXPO_PUBLIC_BFF_URL ?? "http://localhost:4000";
}

/** The market's website, without a trailing slash: the US lives under /us. */
export function siteUrl(): string {
  if (getCurrentMarketId() === "us") return process.env.EXPO_PUBLIC_US_SITE_URL || "https://www.bhavano.com/us";
  return process.env.EXPO_PUBLIC_SITE_URL ?? "https://bhavano.com";
}
