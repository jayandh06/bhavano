import { getMarket } from "@bhavano/types/market";

/**
 * The market this web deployment serves, from the runtime `MARKET` environment variable (`in` or `us`). Unset,
 * empty or unknown is India, so every existing deployment is unchanged. Server-side only: client components read
 * the market from the URL path with `marketFromPath` instead (one build serves both, see
 * docs/plans/us-market-expansion.md).
 */
export const SERVER_MARKET = getMarket(process.env.MARKET);
