import { marketFromPath, stripMarketPrefix, type MarketId } from "@bhavano/types/market";
import { bhavanoSitePath } from "@bhavano/types/messageFormat";
import { siteUrl } from "./marketEndpoints";
import { listingIdFromPath } from "./referralLink";

export interface MarketLink {
  /** Whose server has what the link points to. */
  market: MarketId;
  /** The path inside that market, without "/us" and without the query. */
  path: string;
  /** The link's query, with its "?", or "". */
  query: string;
  /** The page on the website, for opening in the browser. */
  webUrl: string;
}

/** App screens a website `bhavano://` link can ask for (apps/web/src/lib/appLinks.ts, appPathForWebPath). */
const APP_SCHEME_SCREENS = new Set([
  "listing", "listings", "post", "saved", "requirements", "my-requirements", "my-listings", "messages",
  "referrals", "purchases", "help", "about", "contact", "privacy", "terms",
]);

function splitQuery(value: string): { path: string; query: string } {
  const clean = value.split("#")[0];
  const at = clean.indexOf("?");
  const path = at < 0 ? clean : clean.slice(0, at);
  return { path: path.replace(/(.)\/+$/, "$1"), query: at < 0 ? "" : clean.slice(at) };
}

/**
 * Which market a link belongs to, or null for a link that says nothing about it (a sign-in redirect, another site).
 * - A www.bhavano.com link: "/us/..." is the US, everything else India.
 * - A `bhavano://` link: `market=us` (the US website adds it) is the US; without it, a link to one of the app's screens came from the India website.
 * - A bare path: only "/us..." says anything.
 */
export function parseMarketLink(raw: string): MarketLink | null {
  const scheme = /^bhavano:\/*(.*)$/i.exec(raw);
  if (scheme) {
    const { path, query } = splitQuery(`/${scheme[1].replace(/^\/+/, "")}`);
    const tagged = /[?&]market=(in|us)(?=&|$)/.exec(query)?.[1] as MarketId | undefined;
    const first = path.split("/")[1] ?? "";
    if (!tagged && first !== "" && !APP_SCHEME_SCREENS.has(first)) return null;
    const market = tagged ?? "in";
    return { market, path, query, webUrl: `${siteUrl(market)}${webPathForAppPath(path)}` };
  }

  const sitePath = bhavanoSitePath(raw) ?? (raw === "/us" || raw.startsWith("/us/") || raw.startsWith("/us?") ? raw : null);
  if (sitePath === null) return null;
  const { path, query } = splitQuery(sitePath);
  const market = marketFromPath(path);
  const webUrl = raw.startsWith("/") ? `https://www.bhavano.com${raw}` : /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return { market, path: stripMarketPrefix(path), query, webUrl };
}

function webPathForAppPath(path: string): string {
  const [first, ...rest] = path.split("/").filter(Boolean);
  if (!first) return "";
  if (first === "listing" || first === "listings") return rest[0] ? `/listings/${rest[0]}` : "";
  if (first === "saved") return "/favourites";
  return `/${[first, ...rest].join("/")}`;
}

/** The app screen for a market path; Home when the app has none. */
export function appRouteFor(path: string): string {
  const segments = path.split("?")[0].split("/").filter(Boolean);
  const [first, ...rest] = segments;
  if (!first) return "/";
  if (first === "listing" || first === "listings") return rest.length === 1 ? `/listing/${rest[0]}` : "/";
  if (first === "favourites" || first === "saved") return "/saved";
  if (first === "messages") return rest.length <= 2 ? `/${segments.join("/")}` : "/messages";
  if (first === "my-listings") return rest.length === 2 && rest[1] === "edit" ? `/my-listings/${rest[0]}/edit` : "/my-listings";
  if (APP_SCHEME_SCREENS.has(first) || first === "plans" || first === "blog") return rest.length === 0 ? `/${first}` : "/";
  const listingId = listingIdFromPath(path);
  return listingId ? `/listing/${listingId}` : "/";
}

/** The screen that explains a link to another market. */
export function switchMarketRoute(raw: string): string {
  return `/switch-market?url=${encodeURIComponent(raw)}`;
}

/** What Expo Router should open for a link the system hands the app (app/+native-intent.tsx). */
export function routeSystemPath(raw: string, current: MarketId): string {
  const link = parseMarketLink(raw);
  if (!link) return raw;
  if (link.market !== current) return switchMarketRoute(raw);
  // The website's share form of a listing (what this app's Share button sends) has its own screen here.
  if (/^\/listings\/[^/]+$/.test(link.path)) return appRouteFor(link.path);
  // The router knows nothing of "/us": hand it the path inside the market.
  if (marketFromPath(bhavanoSitePath(raw)?.split("?")[0] ?? raw) === "us") return `${link.path}${link.query}`;
  return raw;
}

/** A link to open once the app has moved to its market. Kept across the switch on purpose. */
let pendingLink: string | null = null;

export function setPendingLink(raw: string): void {
  pendingLink = raw;
}

export function takePendingLink(): string | null {
  const raw = pendingLink;
  pendingLink = null;
  return raw;
}
