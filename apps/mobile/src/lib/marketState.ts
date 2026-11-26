import { DEFAULT_MARKET_ID, type MarketId } from "@bhavano/types/market";

/**
 * Which market the app is on, with no storage or React in it, so anything (tests included) can ask. `market.ts` loads and saves the choice.
 *
 * A switch takes two steps so that nothing from the old market's screens runs under the new one: `requestMarketSwitch` lets modules say goodbye
 * while still on the old market, then enters "switching", in which the root layout removes the app's screens; `completeMarketSwitch`, called once
 * they are gone, changes the market, resets module state and returns to "ready". See docs/plans/mobile-market-switch.md ("Switching").
 */
export type MarketPhase = "loading" | "ready" | "switching";

/** A goodbye hook (a network call, say) never holds a switch longer than this. */
export const MARKET_LEAVE_TIMEOUT_MS = 5000;

let current: MarketId = DEFAULT_MARKET_ID;
let pending: MarketId | null = null;
let phase: MarketPhase = "loading";
const listeners = new Set<() => void>();
const leaveHooks = new Set<() => void | Promise<void>>();
const changeHooks = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
}

function runChangeHooks(): void {
  changeHooks.forEach((hook) => {
    try {
      hook();
    } catch {
      // One module failing to reset must not leave the app between markets.
    }
  });
}

export function getCurrentMarketId(): MarketId {
  return current;
}

export function getMarketPhase(): MarketPhase {
  return phase;
}

export function subscribeMarket(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The name a stored value goes under. India keeps today's names, so updating the app signs nobody out; another market gets a suffix. */
export function marketKey(name: string, id: MarketId = current): string {
  return id === DEFAULT_MARKET_ID ? name : `${name}.${id}`;
}

/** Runs before the market changes, while it is still the old one. Returns a function that removes the hook. */
export function beforeMarketLeave(hook: () => void | Promise<void>): () => void {
  leaveHooks.add(hook);
  return () => {
    leaveHooks.delete(hook);
  };
}

/** Runs right after the market changes: drop anything held in memory for the old one. Returns a function that removes the hook. */
export function onMarketChange(hook: () => void): () => void {
  changeHooks.add(hook);
  return () => {
    changeHooks.delete(hook);
  };
}

/** The saved choice has been read (`null`: none, or unreadable). Only the first call counts. */
export function finishMarketLoad(stored: MarketId | null): void {
  if (phase !== "loading") return;
  if (stored && stored !== current) {
    current = stored;
    runChangeHooks();
  }
  phase = "ready";
  emit();
}

function settleWithin(hook: () => void | Promise<void>, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    Promise.resolve()
      .then(hook)
      .catch(() => undefined)
      .finally(() => {
        clearTimeout(timer);
        resolve();
      });
  });
}

/** Starts a switch. False when there is nothing to do: not loaded yet, already switching, or already on that market. */
export async function requestMarketSwitch(next: MarketId): Promise<boolean> {
  if (phase !== "ready" || pending || next === current) return false;
  pending = next;
  await Promise.all([...leaveHooks].map((hook) => settleWithin(hook, MARKET_LEAVE_TIMEOUT_MS)));
  phase = "switching";
  emit();
  return true;
}

/** Finishes a switch once the old market's screens are gone. Returns the new market, or null if no switch was waiting. */
export function completeMarketSwitch(): MarketId | null {
  if (phase !== "switching" || !pending) return null;
  current = pending;
  pending = null;
  runChangeHooks();
  phase = "ready";
  emit();
  return current;
}
