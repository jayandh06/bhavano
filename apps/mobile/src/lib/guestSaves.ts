import { useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ListingCardDto } from "@bhavano/types";
import { GUEST_SAVES_KEY, parseGuestSaves, withGuestSave, withoutGuestSave } from "@bhavano/types/guestSaves";
import { hydrateMarket } from "./market";
import { marketKey, onMarketChange } from "./marketState";

/** Listings saved on this phone while logged out, moved to the account on login by
 * GuestSavesSync. Held in memory and written through to AsyncStorage. See
 * docs/plans/more-login-conversion.md. */
let saves: ListingCardDto[] = [];
const listeners = new Set<() => void>();

/** Saved listings belong to one market's server. */
const storageKey = () => marketKey(GUEST_SAVES_KEY);

function load() {
  const key = storageKey();
  void AsyncStorage.getItem(key)
    .then((raw) => {
      if (key !== storageKey()) return; // the market changed while reading
      saves = parseGuestSaves(raw);
      listeners.forEach((listener) => listener());
    })
    .catch(() => undefined);
}

// Only once the market is known, or a US phone would load India's list.
void hydrateMarket().then(load);
onMarketChange(() => {
  saves = [];
  listeners.forEach((listener) => listener());
  load();
});

function set(next: ListingCardDto[]) {
  saves = next;
  listeners.forEach((listener) => listener());
  const write = next.length ? AsyncStorage.setItem(storageKey(), JSON.stringify(next)) : AsyncStorage.removeItem(storageKey());
  void write.catch(() => undefined);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useGuestSaves(): ListingCardDto[] {
  return useSyncExternalStore(subscribe, () => saves);
}

/** Saves or unsaves `listing` on this phone; returns how many are saved after a save, or null
 * after an unsave. */
export function toggleGuestSave(listing: ListingCardDto): number | null {
  if (saves.some((item) => item.id === listing.id)) {
    set(withoutGuestSave(saves, listing.id));
    return null;
  }
  set(withGuestSave(saves, listing));
  return saves.length;
}

export function guestSaveIds(): string[] {
  return saves.map((item) => item.id);
}

export function clearGuestSaves(): void {
  set([]);
}
