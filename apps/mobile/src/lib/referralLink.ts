import AsyncStorage from "@react-native-async-storage/async-storage";

const REFERRAL_CODE_STORAGE = "bhavano.referralCode";
const REFERRAL_STORED_AT_STORAGE = "bhavano.referralStoredAt";
// Matches web's bhavano_ref cookie TTL (apps/web/src/middleware.ts) — see
// docs/plans/bhavano-referral-program-implementation.md's Phase 1.
const REFERRAL_ATTRIBUTION_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/** Persists the referrer's user id from an incoming deep link (`?ref=<userId>`), alongside when
 * it was stored — read back at signup by getReferralCodeIfFresh. A newer link always overwrites
 * an older one (latest-wins), same rule as web's bhavano_ref cookie. */
export async function storeReferralCode(referralCode: string): Promise<void> {
  await AsyncStorage.setItem(REFERRAL_CODE_STORAGE, referralCode);
  await AsyncStorage.setItem(REFERRAL_STORED_AT_STORAGE, String(Date.now()));
}

/** Read at signup (see HomeSheetsProvider's handleVerifyOtp/handleGoogle/handleApple) —
 * `undefined` once the stored code is older than the attribution window, so a signup long after
 * an old, forgotten deep link doesn't attribute to it. Deliberately not cleared after reading: a
 * failed signup attempt (wrong OTP, a cancelled Google/Apple sheet) must not lose the code before
 * a retry succeeds. */
export async function getReferralCodeIfFresh(): Promise<string | undefined> {
  const [code, storedAtRaw] = await Promise.all([
    AsyncStorage.getItem(REFERRAL_CODE_STORAGE),
    AsyncStorage.getItem(REFERRAL_STORED_AT_STORAGE),
  ]);
  if (!code || !storedAtRaw) return undefined;
  const storedAt = Number(storedAtRaw);
  if (!Number.isFinite(storedAt) || Date.now() - storedAt > REFERRAL_ATTRIBUTION_WINDOW_MS) return undefined;
  return code;
}

const UUID_SUFFIX_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CUID_SUFFIX_RE = /-([a-z0-9]{20,})$/i;

/** Pulls a listing id out of a bhavano.com listing URL's last path segment
 * (`/{city}/{area}/{group}/{category}/{slug}-{id}`, see packages/types/src/listingPath.ts).
 * Matches the id's own shape (a cuid, or a legacy uuid) — same rule as the web's
 * `looksLikeListingSlugId` — because plenty of non-listing segments contain a hyphen too
 * (`/bengaluru/hsr-layout`, `/bengaluru/rent-lease`, `bhavano://my-listings`). Returns undefined
 * for any other path rather than guessing. */
export function listingIdFromPath(pathname: string): string | undefined {
  const last = pathname.split("/").filter(Boolean).at(-1);
  if (!last) return undefined;
  return last.match(UUID_SUFFIX_RE)?.[0] ?? last.match(CUID_SUFFIX_RE)?.[1];
}
