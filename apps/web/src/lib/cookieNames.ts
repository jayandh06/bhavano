/**
 * Cookie names for this build. India and the US share the host www.bhavano.com, so a cookie set by one would also be sent to the other
 * (a browser sends every cookie whose path matches, and the US path "/us" sits under "/"). The US build therefore uses its own names:
 * `bhavano_sid` becomes `bhavano_sid_us`. India's names are unchanged. `NEXT_PUBLIC_MARKET` is fixed at build time.
 */
const SUFFIX = process.env.NEXT_PUBLIC_MARKET === "us" ? "_us" : "";

export function cookieName(base: string): string {
  return `${base}${SUFFIX}`;
}
