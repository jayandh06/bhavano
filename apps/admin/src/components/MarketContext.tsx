"use client";

import { createContext, useContext } from "react";
import type { MarketId } from "@bhavano/types/market";

/** Which market this admin deployment manages, for client components. The server reads it from the runtime environment
 * (`adminMarket`) and hands it down here, since one admin image serves both markets. */
const MarketContext = createContext<MarketId>("in");

export function MarketProvider({ id, children }: { id: MarketId; children: React.ReactNode }) {
  return <MarketContext.Provider value={id}>{children}</MarketContext.Provider>;
}

export function useAdminMarketId(): MarketId {
  return useContext(MarketContext);
}
