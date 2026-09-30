import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "react-native";
import type { BoostPlanSelection, City, ListingCategory, TransactionType } from "@bhavano/types";

/**
 * The post-ad form, saved on the device while it is filled in, so the app being killed in the
 * background (switching out to read the login OTP, the photo picker on a low-memory phone) never
 * loses it. Photos are kept as the picker's file URIs; one the OS has since cleared from the cache
 * is dropped on restore. Videos are not kept. Cleared once the listing is created. Mirrors the
 * website's lib/postAdDraft.ts — see docs/plans/post-ad-draft-autosave.md.
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
  /** The chosen city, so one resolved by the map pin (not in the screen's list) can be restored. */
  city: City | null;
  areaQuery: string;
  areaId: string | null;
  /** Absent in drafts saved while the form still had a Specs box instead. */
  description?: string;
  pin: { lat: number; lng: number } | null;
  attributes: Record<string, string | string[]>;
  photoUris: string[];
  selectedBoostPlan: BoostPlanSelection | null;
}

const KEY = "bhavano:post-ad-draft";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** How recent a draft found at app start must be to count as the app having been killed mid-post
 * (switching out to read the OTP) rather than a later visit. */
const RESUME_WINDOW_MS = 10 * 60 * 1000;

// The app has no tabs to tell a restart mid-post from a later visit (the website uses
// sessionStorage), so: leaving the form while the app keeps running marks it left, and after a
// restart only a draft saved in the last few minutes resumes by itself.
let leftFormThisRun = false;

/** Called when the form closes without the listing being posted. */
export function markPostAdDraftLeft(): void {
  leftFormThisRun = true;
}

function fileStillThere(uri: string): Promise<boolean> {
  return new Promise((resolve) =>
    Image.getSize(
      uri,
      () => resolve(true),
      () => resolve(false),
    ),
  );
}

/** `resume`: pick up where the seller was, unasked. Otherwise offer the draft as a choice. */
export async function loadPostAdDraft(): Promise<{ draft: PostAdDraft; savedAt: number; resume: boolean } | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as { savedAt: number; draft: PostAdDraft };
    if (!saved?.draft?.category || Date.now() - saved.savedAt > MAX_AGE_MS) {
      await clearPostAdDraft();
      return null;
    }
    const present = await Promise.all(saved.draft.photoUris.map(fileStillThere));
    return {
      draft: { ...saved.draft, photoUris: saved.draft.photoUris.filter((_, i) => present[i]) },
      savedAt: saved.savedAt,
      resume: !leftFormThisRun && Date.now() - saved.savedAt < RESUME_WINDOW_MS,
    };
  } catch {
    return null;
  }
}

export async function savePostAdDraft(draft: PostAdDraft): Promise<void> {
  leftFormThisRun = false;
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({ savedAt: Date.now(), draft }));
  } catch {
    // Best-effort — the form still works, it just isn't kept.
  }
}

export async function clearPostAdDraft(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
