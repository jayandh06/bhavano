import { useEffect, useMemo, type ReactNode } from "react";
import { View } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { applyMarketSwitch, hydrateMarket, useMarket, useMarketPhase } from "../lib/market";

/** The brand green of the splash screen and status bar, shown for the moment there is no market to draw. */
const HOLD_COLOUR = "#11523C";

/** Draws the app only once the market is known, and again from scratch after a switch: new screens, new providers and an empty query cache, so
 * nothing fetched from one market's server can appear in the other. While loading or switching there are no screens at all. See
 * docs/plans/mobile-market-switch.md ("Switching"). */
export function MarketRoot({ children }: { children: ReactNode }) {
  const { id } = useMarket();
  const phase = useMarketPhase();
  // Keyed on the market: a cache belongs to one server.
  const queryClient = useMemo(() => new QueryClient(), [id]);

  useEffect(() => {
    void hydrateMarket();
  }, []);

  // An effect, so it runs only after the render that removed the old screens, once their own cleanup has run.
  useEffect(() => {
    if (phase === "switching") applyMarketSwitch();
  }, [phase]);

  if (phase !== "ready") return <View style={{ flex: 1, backgroundColor: HOLD_COLOUR }} />;

  return (
    <QueryClientProvider key={id} client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
