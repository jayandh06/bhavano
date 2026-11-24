"use client";

import { usePathname } from "next/navigation";
import { getMarket, marketFromPath, type MarketConfig } from "@bhavano/types/market";

/**
 * The market of the page being viewed, from the URL path: `/us` and `/us/...` are the US, everything else is India. One
 * web build serves both, so client components read the market here instead of a build-time setting. Server code uses
 * `SERVER_MARKET` (`lib/serverMarket.ts`). See docs/plans/us-market-expansion.md.
 */
export function useMarket(): MarketConfig {
  return getMarket(marketFromPath(usePathname() ?? "/"));
}
