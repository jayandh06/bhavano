"use client";

import { usePathname } from "next/navigation";
import { getMarket, isMarketId, marketFromPath, type MarketConfig } from "@bhavano/types/market";

/** Set when the image was built for one market (the US image is built with NEXT_PUBLIC_MARKET=us and basePath /us, so the path
 * `usePathname` reports no longer carries the "/us" prefix). Unset, the market comes from the URL path. */
const BUILT_MARKET = process.env.NEXT_PUBLIC_MARKET;

/**
 * The market of the page being viewed, from the URL path: `/us` and `/us/...` are the US, everything else is India. One
 * web build serves both, so client components read the market here instead of a build-time setting. Server code uses
 * `SERVER_MARKET` (`lib/serverMarket.ts`). See docs/plans/us-market-expansion.md.
 */
export function useMarket(): MarketConfig {
  const pathname = usePathname() ?? "/";
  return getMarket(isMarketId(BUILT_MARKET) ? BUILT_MARKET : marketFromPath(pathname));
}
