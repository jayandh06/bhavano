"use client";

import { useSyncExternalStore } from "react";
import type { ListingCardDto } from "@bhavano/types";
import { GUEST_SAVES_KEY, parseGuestSaves, withGuestSave, withoutGuestSave } from "@bhavano/types/guestSaves";

/** Fired on every change in this tab (the `storage` event covers other tabs). `detail` is set when
 * a listing was just saved, so the toast can ask for a login. */
export const GUEST_SAVES_EVENT = "bhavano:guest-saves";
export type GuestSavesEventDetail = { savedCount: number } | undefined;

const EMPTY: ListingCardDto[] = [];
let cachedRaw: string | null = null;
let cachedList: ListingCardDto[] = EMPTY;

function snapshot(): ListingCardDto[] {
  const raw = localStorage.getItem(GUEST_SAVES_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedList = parseGuestSaves(raw);
  }
  return cachedList;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(GUEST_SAVES_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(GUEST_SAVES_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function write(list: ListingCardDto[], detail?: GuestSavesEventDetail) {
  if (list.length === 0) localStorage.removeItem(GUEST_SAVES_KEY);
  else localStorage.setItem(GUEST_SAVES_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent<GuestSavesEventDetail>(GUEST_SAVES_EVENT, { detail }));
}

/** Listings saved on this device while logged out. Empty during server render. */
export function useGuestSaves(): ListingCardDto[] {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}

/** Saves or unsaves `listing` on this device; returns whether it's now saved. */
export function toggleGuestSave(listing: ListingCardDto): boolean {
  const list = snapshot();
  if (list.some((item) => item.id === listing.id)) {
    write(withoutGuestSave(list, listing.id));
    return false;
  }
  const next = withGuestSave(list, listing);
  write(next, { savedCount: next.length });
  return true;
}

export function readGuestSaveIds(): string[] {
  return snapshot().map((item) => item.id);
}

export function clearGuestSaves(): void {
  write(EMPTY);
}
