/** The query string worth keeping on a page-view row: the filters and options that say *which*
 * page a visitor saw (/bengaluru/rent-lease?bedrooms=2&minPrice=15000), without anything that
 * identifies them or only describes how they arrived.
 *
 * Dropped: ad click identifiers and campaign tags (already stored once per session on the Visit),
 * referral codes and anything token-like, the app marker, and framework-internal params. Values
 * are cut to 80 characters and the whole string to 300. Returns null when nothing is left.
 * See docs/plans/page-visit-query-strings.md. */
const DROPPED_KEYS = new Set([
  "gclid",
  "gbraid",
  "wbraid",
  "fbclid",
  "msclkid",
  "campaignid",
  "adgroupid",
  "adid",
  "app",
  "rememberCity",
  "ref",
  "token",
  "code",
  "otp",
  "password",
  "access_token",
  "id_token",
  "state",
  "session",
  "sid",
]);

const MAX_VALUE = 80;
const MAX_QUERY = 300;

function safeDecode(part: string): string {
  try {
    return decodeURIComponent(part.split("+").join(" "));
  } catch {
    return part;
  }
}

export function sanitizePageViewQuery(search: string | null | undefined): string | null {
  if (!search) return null;
  const kept: string[] = [];
  let length = 0;
  for (const raw of (search.startsWith("?") ? search.slice(1) : search).split("&")) {
    if (!raw) continue;
    const eq = raw.indexOf("=");
    const key = safeDecode(eq === -1 ? raw : raw.slice(0, eq));
    const value = safeDecode(eq === -1 ? "" : raw.slice(eq + 1));
    if (!key || DROPPED_KEYS.has(key) || key.startsWith("utm_") || key.startsWith("_") || key.startsWith("__")) continue;
    const pair = `${encodeURIComponent(key)}=${encodeURIComponent(value.slice(0, MAX_VALUE))}`;
    // +1 for the joining "&"; stop at the last whole pair that fits rather than cut one in half.
    if (length + pair.length + (kept.length ? 1 : 0) > MAX_QUERY) break;
    length += pair.length + (kept.length ? 1 : 0);
    kept.push(pair);
  }
  return kept.length > 0 ? kept.join("&") : null;
}

/** The query as people read it: `bedrooms=2&area=HSR Layout`, undone from URL encoding where that is
 * safe. For display in admin only; the stored form stays encoded. */
export function readablePageViewQuery(query: string | null | undefined): string {
  if (!query) return "";
  return query
    .split("&")
    .map((pair) => {
      try {
        return decodeURIComponent(pair.replace(/\+/g, " "));
      } catch {
        return pair;
      }
    })
    .join("&");
}
