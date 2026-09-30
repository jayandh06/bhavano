import { useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ListingCardDto } from "@bhavano/types";
import { GUEST_SAVES_KEY, parseGuestSaves, withGuestSave, withoutGuestSave } from "@bhavano/types/guestSaves";

/** Listings saved on this phone while logged out, moved to the account on login by
 * GuestSavesSync. Held in memory and written through to AsyncStorage. See
 * docs/plans/more-login-conversion.md. */
let saves: ListingCardDto[] = [];
const listeners = new Set<() => void>();

void AsyncStorage.getItem(GUEST_SAVES_KEY)
  .then((raw) => {
    saves = parseGuestSaves(raw);
    listeners.forEach((listener) => listener());
  })
  .catch(() => undefined);

function set(next: ListingCardDto[]) {
  saves = next;
  listeners.forEach((listener) => listener());
  const write = next.length ? AsyncStorage.setItem(GUEST_SAVES_KEY, JSON.stringify(next)) : AsyncStorage.removeItem(GUEST_SAVES_KEY);
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
