import type { FeaturedUpsellMemory } from "@bhavano/types/featuredUpsell";

/** What this browser remembers about offering Featured for one ad: how many times, and when the owner last said "Not now". Per ad and per browser (localStorage); the
 * once-per-session rule uses sessionStorage under its own key. Every access is guarded: private windows and blocked storage must never break the page. */
const key = (listingId: string) => `bhavano_featured_upsell:${listingId}`;

export function readUpsellMemory(listingId: string): FeaturedUpsellMemory {
  try {
    const raw = localStorage.getItem(key(listingId));
    if (!raw) return { shows: 0, dismissedAtMs: null };
    const parsed = JSON.parse(raw) as Partial<FeaturedUpsellMemory>;
    return { shows: Number(parsed.shows) || 0, dismissedAtMs: typeof parsed.dismissedAtMs === "number" ? parsed.dismissedAtMs : null };
  } catch {
    return { shows: 0, dismissedAtMs: null };
  }
}

export function writeUpsellMemory(listingId: string, memory: FeaturedUpsellMemory): void {
  try {
    localStorage.setItem(key(listingId), JSON.stringify(memory));
  } catch {
    /* storage unavailable: the prompt may show again, which is the safe direction */
  }
}

export function sessionFlag(name: string): boolean {
  try {
    return sessionStorage.getItem(name) === "1";
  } catch {
    return false;
  }
}

export function setSessionFlag(name: string): void {
  try {
    sessionStorage.setItem(name, "1");
  } catch {
    /* ignore */
  }
}
