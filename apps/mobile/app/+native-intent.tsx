import { getCurrentMarketId, hydrateMarket } from "../src/lib/market";
import { routeSystemPath } from "../src/lib/marketLinks";

/** Expo Router asks this where to go for every link the system hands the app, before any screen exists. A link to the other market goes to a
 * screen that says so, never to a missing or wrong page. See docs/plans/mobile-market-switch.md ("Links"). */
export async function redirectSystemPath({ path }: { path: string; initial: boolean }): Promise<string> {
  try {
    // At launch this runs before the saved market has been read.
    await hydrateMarket();
    return routeSystemPath(path, getCurrentMarketId());
  } catch {
    // A link must never stop the app opening.
    return path;
  }
}
