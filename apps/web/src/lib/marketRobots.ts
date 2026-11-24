import { getMarket } from "@bhavano/types/market";

/**
 * The site-wide `robots` metadata for this build. A market that is not launched (`indexable: false`, the US until
 * go-live) is `noindex, nofollow` on every page, so the US stack can be reachable and shared for testing without
 * search engines picking it up. India is `index, follow`, exactly as before.
 *
 * Read from `NEXT_PUBLIC_MARKET`, which the US image is built with (so it is fixed at build, like the base path),
 * falling back to the runtime `MARKET`. Pages that set their own `robots` (thin area pages, checkout, ...) replace
 * this, and they are all `index: false` already, so nothing can re-open a noindexed market.
 *
 * Go-live is one change: `indexable: true` for `us` in `packages/types/src/market.ts` (plus the Caddy header, see
 * Caddyfile.us). See docs/plans/us-stack-setup.md.
 */
export function siteRobots(marketId: string | undefined = process.env.NEXT_PUBLIC_MARKET || process.env.MARKET) {
  const indexable = getMarket(marketId).indexable;
  return { index: indexable, follow: indexable };
}
