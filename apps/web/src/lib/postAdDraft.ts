import type { BoostPlanSelection, City, ListingCategory, TransactionType } from "@bhavano/types";

/**
 * The post-ad form, saved on this device while it is filled in, so a page reload (a sign-in that
 * lands on a new deploy, a pull-to-refresh, the browser dropping a background tab) never loses
 * it. Fields go to localStorage; photos, which are required and too large for it, go to
 * IndexedDB as the File objects themselves. Videos are not kept. Cleared once the listing is
 * created. See docs/plans/post-ad-draft-autosave.md.
 */
export interface PostAdDraft {
  step: "category" | "transactionType" | "details" | "review";
  category: ListingCategory;
  transactionType: TransactionType | null;
  price: string;
  priceQualifier: string;
  priceMode: "total" | "perUnit";
  title: string;
  cityId: string;
  /** The chosen city, so one added by the map pin (not in the page's list) can be restored. */
  city: City | null;
  areaQuery: string;
  areaId: string | null;
  pin: { lat: number; lng: number } | null;
  description: string;
  attributes: Record<string, string | string[]>;
  selectedBoostPlan: BoostPlanSelection | null;
}

const FIELDS_KEY = "bhavano:post-ad-draft";
const DB_NAME = "bhavano-drafts";
const STORE = "post-ad-photos";
const PHOTOS_KEY = "photos";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = run(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export async function loadPostAdDraft(): Promise<{ draft: PostAdDraft; photos: File[] } | null> {
  try {
    const raw = localStorage.getItem(FIELDS_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as { savedAt: number; draft: PostAdDraft };
    if (!saved?.draft?.category || Date.now() - saved.savedAt > MAX_AGE_MS) {
      await clearPostAdDraft();
      return null;
    }
    const photos = await withStore<File[] | undefined>("readonly", (store) => store.get(PHOTOS_KEY)).catch(
      () => undefined,
    );
    return { draft: saved.draft, photos: photos ?? [] };
  } catch {
    return null;
  }
}

export function savePostAdDraftFields(draft: PostAdDraft): void {
  try {
    localStorage.setItem(FIELDS_KEY, JSON.stringify({ savedAt: Date.now(), draft }));
  } catch {
    // Storage full or disabled (private mode) — the form still works, it just isn't kept.
  }
}

export async function savePostAdDraftPhotos(files: File[]): Promise<void> {
  try {
    await withStore("readwrite", (store) => store.put(files, PHOTOS_KEY));
  } catch {
    // Same as above: best-effort.
  }
}

export async function clearPostAdDraft(): Promise<void> {
  try {
    localStorage.removeItem(FIELDS_KEY);
    await withStore("readwrite", (store) => store.delete(PHOTOS_KEY));
  } catch {
    // Nothing to clear, or storage unavailable.
  }
}
