import type { BoostPlanSelection, City, ListingCategory, TransactionType } from "@bhavano/types";

/**
 * The post-ad form, saved on this device while it is filled in, so a page reload (a sign-in that
 * lands on a new deploy, a pull-to-refresh, the browser dropping a background tab) never loses
 * it. Fields go to localStorage; photos, which are required and too large for it, go to
 * IndexedDB as their bytes. Videos are not kept. Cleared once the listing is created. See
 * docs/plans/post-ad-draft-autosave.md.
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
/** sessionStorage, so it survives a reload of this tab but not a new tab or a later visit. */
const TAB_KEY = "bhavano:post-ad-draft-tab";
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

/**
 * Bytes, not the File. iOS WebKit can store a picked File as a reference to the photo picker's
 * temporary copy, which iOS deletes later; the restored File then still previews from cache but
 * uploads as a truncated body (Next.js fails it with "Unexpected end of form").
 */
interface StoredPhoto {
  name: string;
  type: string;
  lastModified: number;
  data: ArrayBuffer;
}

/** A memory-backed copy of `file`. Rejects when the file's bytes can no longer be read. */
export async function inMemoryCopy(file: File): Promise<File> {
  return new File([await file.arrayBuffer()], file.name, { type: file.type, lastModified: file.lastModified });
}

/** Drafts saved before photos were stored as bytes hold File objects; they are kept only if still readable. */
async function restorePhoto(stored: StoredPhoto | File): Promise<File | null> {
  if (stored instanceof Blob) return inMemoryCopy(stored).catch(() => null);
  if (!stored?.data) return null;
  return new File([stored.data], stored.name, { type: stored.type, lastModified: stored.lastModified });
}

/**
 * Whether the saved draft was being written in this tab when the page last unloaded — a reload
 * mid-post (a sign-in landing on a new deploy, a discarded tab, pull-to-refresh), which resumes
 * where the seller was. Otherwise it's a new visit, and the seller chooses whether to continue.
 */
export function draftBelongsToThisTab(): boolean {
  try {
    return sessionStorage.getItem(TAB_KEY) === "1";
  } catch {
    return false;
  }
}

/** Called when the form is left without a reload, so coming back to it counts as a new visit. */
export function releaseDraftFromThisTab(): void {
  try {
    sessionStorage.removeItem(TAB_KEY);
  } catch {
    // Storage unavailable.
  }
}

export async function loadPostAdDraft(): Promise<{
  draft: PostAdDraft;
  savedAt: number;
  photos: File[];
  droppedPhotos: number;
} | null> {
  try {
    const raw = localStorage.getItem(FIELDS_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as { savedAt: number; draft: PostAdDraft };
    if (!saved?.draft?.category || Date.now() - saved.savedAt > MAX_AGE_MS) {
      await clearPostAdDraft();
      return null;
    }
    const stored = await withStore<(StoredPhoto | File)[] | undefined>("readonly", (store) => store.get(PHOTOS_KEY)).catch(
      () => undefined,
    );
    const restored = await Promise.all((stored ?? []).map(restorePhoto));
    const photos = restored.filter((photo): photo is File => photo !== null);
    return { draft: saved.draft, savedAt: saved.savedAt, photos, droppedPhotos: restored.length - photos.length };
  } catch {
    return null;
  }
}

export function savePostAdDraftFields(draft: PostAdDraft): void {
  try {
    localStorage.setItem(FIELDS_KEY, JSON.stringify({ savedAt: Date.now(), draft }));
    sessionStorage.setItem(TAB_KEY, "1");
  } catch {
    // Storage full or disabled (private mode) — the form still works, it just isn't kept.
  }
}

// Reading the bytes is async, so an older save could otherwise land after a newer one (or a clear).
let photoSaveSeq = 0;

export async function savePostAdDraftPhotos(files: File[]): Promise<void> {
  const seq = ++photoSaveSeq;
  try {
    const stored: StoredPhoto[] = [];
    for (const file of files) {
      try {
        stored.push({ name: file.name, type: file.type, lastModified: file.lastModified, data: await file.arrayBuffer() });
      } catch {
        // Unreadable already; onSubmit reports it when it tries to upload.
      }
    }
    if (seq !== photoSaveSeq) return;
    await withStore("readwrite", (store) => store.put(stored, PHOTOS_KEY));
  } catch {
    // Same as above: best-effort.
  }
}

export async function clearPostAdDraft(): Promise<void> {
  photoSaveSeq++;
  releaseDraftFromThisTab();
  try {
    localStorage.removeItem(FIELDS_KEY);
    await withStore("readwrite", (store) => store.delete(PHOTOS_KEY));
  } catch {
    // Nothing to clear, or storage unavailable.
  }
}
