import { getMarket, MARKETS } from "@bhavano/types/market";

/**
 * The market this build serves, for robots, sitemap and the site-wide `robots` metadata. Read from `NEXT_PUBLIC_MARKET`,
 * which the US image is built with (so it is fixed at build, like the base path), falling back to the runtime `MARKET`.
 * Unset or unknown is India.
 */
export function buildMarket(marketId: string | undefined = process.env.NEXT_PUBLIC_MARKET || process.env.MARKET) {
  return getMarket(marketId);
}

/**
 * The site-wide `robots` metadata for this build. A market that is not launched (`indexable: false`, the US until
 * go-live) is `noindex, nofollow` on every page, so the US stack can be reachable and shared for testing without
 * search engines picking it up. India is `index, follow`, exactly as before.
 *
 * Pages that set their own `robots` (thin area pages, checkout, ...) replace this, and they are all `index: false`
 * already, so nothing can re-open a noindexed market.
 *
 * Go-live is one change: `indexable: true` for `us` in `packages/types/src/market.ts` (plus the Caddy header, see
 * Caddyfile.us). See docs/plans/us-stack-setup.md.
 */
export function siteRobots(marketId?: string) {
  const indexable = buildMarket(marketId).indexable;
  return { index: indexable, follow: indexable };
}

/**
 * The `Sitemap:` lines for robots.txt: this host's own, plus the US one on India's host once the US is indexable (the same
 * `indexable` flip as the page meta tag, so launch is one change). Crawlers only read the host-root robots.txt, which is
 * India's, so that is where the US sitemap has to be listed. Until launch the list is India's alone, as before.
 */
export function robotsSitemaps(siteUrl: string, marketId?: string): string[] {
  const own = `${siteUrl}/sitemap.xml`;
  if (buildMarket(marketId).id !== "in" || !MARKETS.us.indexable) return [own];
  return [own, `${siteUrl}${MARKETS.us.pathPrefix}/sitemap.xml`];
}
