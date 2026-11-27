import { getMarket, type MarketConfig } from "@bhavano/types/market";

/** The market this admin site runs, from MARKET (set in docker-compose.us.yml). Unset means India. The same image serves both, so this is read
 * on the server at request time: pass what a client component needs as a prop. */
export function adminMarket(): MarketConfig {
  return getMarket(process.env.MARKET);
}
