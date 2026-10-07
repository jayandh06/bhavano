import type { ListingCategory, TransactionType } from "./index";

/** The second, optional description language a seller can pick — Featured tier only. English is
 * always generated as the primary language; this is purely additive. No existing locale/language
 * concept exists anywhere else in this codebase (User, Listing) — this is the first one. */
export type IndianLanguage = "hi" | "ta" | "te" | "kn" | "ml" | "mr" | "bn" | "gu" | "pa" | "or";

export const INDIAN_LANGUAGES: readonly IndianLanguage[] = ["hi", "ta", "te", "kn", "ml", "mr", "bn", "gu", "pa", "or"];

export const INDIAN_LANGUAGE_LABELS: Record<IndianLanguage, string> = {
  hi: "Hindi",
  ta: "Tamil",
  te: "Telugu",
  kn: "Kannada",
  ml: "Malayalam",
  mr: "Marathi",
  bn: "Bengali",
  gu: "Gujarati",
  pa: "Punjabi",
  or: "Odia",
};

/** Which field(s) to generate in one call — a title-only request never triggers the (expensive)
 * nearby-landmarks lookup, since that only ever backs the description. */
export type GenerateListingCopyField = "title" | "description";

/** Two valid shapes, enforced by the BFF, not by this type (TypeScript can't express "exactly one
 * of A or B" cleanly here without hurting the DTO's own validation decorators):
 *
 * - No `listingId`: the posting wizard's "details" step, before any real Listing row exists.
 *   Caller supplies every structured field directly. Tier is always `'free'` here — there is
 *   nothing to be boosted yet, so this is never read from anything the client sends.
 * - `listingId` only: the post-creation "regenerate with Featured" flow. Every structured field
 *   below is ignored if sent — the BFF re-derives them (and the real tier) from the DB row,
 *   never trusting the client once a real listing exists. See docs/plans/ai-listing-copy-assist.md. */
export interface GenerateListingCopyInput {
  listingId?: string;
  fields: GenerateListingCopyField[];
  category?: ListingCategory;
  transactionType?: TransactionType;
  price?: number;
  priceQualifier?: string;
  cityName?: string;
  areaName?: string;
  attributes?: Record<string, unknown>;
  lat?: number;
  lng?: number;
  /** Only meaningful when `description` is requested and the resolved tier is `featured`. */
  secondLanguage?: IndianLanguage;
}

export interface GenerateListingCopyResult {
  title?: string;
  description?: string;
  descriptionSecondLanguage?: string;
  /** Which tier actually produced this result — returned explicitly rather than assumed, so a
   * client that thinks a just-bought boost is already active (a webhook landing a beat late) sees
   * `'free'` honestly instead of a silently-downgraded result under a Featured banner. */
  tierUsed: "free" | "featured";
  /** Real place names the description actually narrates — empty when landmarks weren't looked up
   * (free tier, or no lat/lng) or the lookup found nothing nearby. Never a name the model invented
   * on its own. */
  landmarksUsed: string[];
}
