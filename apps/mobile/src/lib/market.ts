import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";
import { getMarket, isMarketId, type MarketConfig, type MarketId } from "@bhavano/types/market";

/**
 * The market the app is showing: India unless something has chosen another one. Held in memory and persisted, so a US
 * account keeps its market across launches. Nothing sets it yet; the choice (per account or per install) and the US API
 * address come with the market switch, see docs/plans/us-market-expansion.md ("Mobile apps"). Every screen reads it
 * through `useMarket` so that switch only has to call `setCurrentMarket`.
 */
const STORAGE_KEY = "bhavano.market";

let current: MarketId = "in";
let hydrated = false;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
}

/** Loads the persisted market once. A stored value that is not a known market is ignored (India). */
export function hydrateMarket(): Promise<void> {
  if (hydrated) return Promise.resolve();
  hydrated = true;
  return AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => {
      if (isMarketId(raw) && raw !== current) {
        current = raw;
        emit();
      }
    })
    .catch(() => undefined);
}
void hydrateMarket();

export function getCurrentMarketId(): MarketId {
  return current;
}

export function setCurrentMarket(id: MarketId): void {
  if (id === current) return;
  current = id;
  hydrated = true;
  emit();
  void AsyncStorage.setItem(STORAGE_KEY, id).catch(() => undefined);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The market config for the screen being drawn; re-renders when the market changes. */
export function useMarket(): MarketConfig {
  return getMarket(useSyncExternalStore(subscribe, getCurrentMarketId, getCurrentMarketId));
}
