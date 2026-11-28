/**
 * The visitor's address, from the `X-Forwarded-For` header our Caddy hands on.
 *
 * Caddy appends the peer it saw to whatever header it trusted, so the address to believe is read from the right: a
 * client's own invented entries sit on the left. With one Caddy in front, that is the last entry.
 *
 * The US has two: www.bhavano.com/us arrives at India's Caddy, which forwards it to the US's. The US Caddy trusts
 * India's and appends it, so the last entry is always India's server and the visitor is the one before. Our own proxies
 * are named in `TRUSTED_PROXY_IPS` (comma-separated) and skipped. Unset, as in India, nothing is skipped.
 */
export function visitorIp(forwarded: string | null | undefined, trustedProxies: string | undefined = process.env.TRUSTED_PROXY_IPS): string | undefined {
  const hops = (forwarded ?? "").split(",").map((hop) => hop.trim()).filter(Boolean);
  const trusted = new Set((trustedProxies ?? "").split(",").map((ip) => ip.trim()).filter(Boolean));
  // The last entry left is kept even if it is a proxy of ours: it is then the only address there is.
  while (hops.length > 1 && trusted.has(hops[hops.length - 1])) hops.pop();
  return hops[hops.length - 1];
}
