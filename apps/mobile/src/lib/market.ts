import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";
import { getMarket, isMarketId, type MarketConfig, type MarketId } from "@bhavano/types/market";
import {
  completeMarketSwitch,
  finishMarketLoad,
  getCurrentMarketId,
  getMarketPhase,
  requestMarketSwitch,
  subscribeMarket,
  type MarketPhase,
} from "./marketState";

export { getCurrentMarketId, marketKey } from "./marketState";

/**
 * The market the app is showing: India unless something has chosen another one. Saved on the phone, so the choice lasts across launches. Nothing in
 * the app calls `switchMarket` yet (the Country setting and first-run chooser are phase 4 of docs/plans/mobile-market-switch.md). The root layout
 * shows nothing until the saved choice has loaded, so no request can go to the wrong market's server. Every screen reads it through `useMarket`.
 */
const STORAGE_KEY = "bhavano.market";

let hydration: Promise<void> | null = null;

/** Loads the saved market once. A stored value that is not a known market, or storage failing, means India. */
export function hydrateMarket(): Promise<void> {
  hydration ??= AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => finishMarketLoad(isMarketId(raw) ? raw : null))
    .catch(() => finishMarketLoad(null));
  return hydration;
}

/** Moves the app to another market. The root layout finishes the switch by calling `applyMarketSwitch`. */
export async function switchMarket(id: MarketId): Promise<void> {
  await hydrateMarket();
  await requestMarketSwitch(id);
}

/** For the root layout only: call once the old market's screens have been removed. */
export function applyMarketSwitch(): void {
  const id = completeMarketSwitch();
  if (id) void AsyncStorage.setItem(STORAGE_KEY, id).catch(() => undefined);
}

export function useMarketPhase(): MarketPhase {
  return useSyncExternalStore(subscribeMarket, getMarketPhase, getMarketPhase);
}

/** The market config for the screen being drawn; re-renders when the market changes. */
export function useMarket(): MarketConfig {
  return getMarket(useSyncExternalStore(subscribeMarket, getCurrentMarketId, getCurrentMarketId));
}
