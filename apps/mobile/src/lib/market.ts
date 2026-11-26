import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";
import { getMarket, isMarketId, type MarketConfig, type MarketId } from "@bhavano/types/market";
import {
  askForFirstMarket,
  completeFirstChoice,
  completeMarketSwitch,
  finishMarketLoad,
  getCurrentMarketId,
  getMarketPhase,
  isMarketOffered,
  requestMarketSwitch,
  subscribeMarket,
  type MarketPhase,
} from "./marketState";
import { deviceRegion } from "./deviceRegion";

export { getCurrentMarketId, marketKey, marketSwitchEnabled } from "./marketState";

/**
 * The market the app is showing: India unless something has chosen another one. Saved on the phone, so the choice lasts across launches. The root
 * layout shows nothing until it is known, so no request can go to the wrong market's server. Every screen reads it through `useMarket`.
 *
 * On a build that offers the US, a new install whose phone region is the US is asked once. An install that already has stored data is an update
 * from an earlier version and stays on India without a question, as does every other region. See docs/plans/mobile-market-switch.md.
 */
const STORAGE_KEY = "bhavano.market";

let hydration: Promise<void> | null = null;

async function load(): Promise<void> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (isMarketId(raw)) return finishMarketLoad(isMarketOffered(raw) ? raw : null);
  if (isMarketOffered("us") && deviceRegion() === "US") {
    // Must be read before anything else writes: the app's screens, which do, are not drawn yet.
    const stored = await AsyncStorage.getAllKeys();
    if (stored.length === 0) return askForFirstMarket();
    // An update: remember India, so a later launch never asks.
    await AsyncStorage.setItem(STORAGE_KEY, "in");
  }
  finishMarketLoad(null);
}

/** Loads the saved market once. A stored value that is not a known, offered market, or storage failing, means India. Resolves once the app knows
 * what to do, which on a first launch may be to ask (the phase is then "choosing"). */
export function hydrateMarket(): Promise<void> {
  hydration ??= load().catch(() => finishMarketLoad(null));
  return hydration;
}

/** The person's answer on a new install. */
export function chooseFirstMarket(id: MarketId): void {
  if (completeFirstChoice(id)) void AsyncStorage.setItem(STORAGE_KEY, id).catch(() => undefined);
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
