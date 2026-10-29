/** The "make your ad Featured" ask shown to an owner who has a live ad that is not Featured: a dialog when they open My listings and a slim card on their own listing page.
 * Admin-controlled (Admin -> Settings -> Featured prompt), off by default. See docs/plans/featured-upsell-prompt.md. */
export interface FeaturedUpsellSettingsDto {
  /** The dialog on My listings. */
  enabled: boolean;
  /** The slim card at the top of the owner's own listing page. */
  listingCardEnabled: boolean;
  /** An ad this young is left alone: the owner has just been offered Featured while posting. */
  minAgeHours: number;
  /** After "Not now", stay quiet for this many days (per ad). */
  quietDays: number;
  /** Most times one ad is ever offered, so a firm "no" is respected. */
  maxShowsPerAd: number;
}

export const DEFAULT_FEATURED_UPSELL_SETTINGS: FeaturedUpsellSettingsDto = {
  enabled: false,
  listingCardEnabled: false,
  minAgeHours: 1,
  quietDays: 3,
  maxShowsPerAd: 3,
};

/** What the browser remembers about one ad: how often it was offered and when the owner last said "Not now". */
export interface FeaturedUpsellMemory {
  shows: number;
  dismissedAtMs: number | null;
}

export interface UpsellCandidate {
  id: string;
  status: string;
  publishState?: string | null;
  isBoosted: boolean;
  createdAt: string;
}

export function isUpsellEligibleListing(l: UpsellCandidate, minAgeHours: number, nowMs: number): boolean {
  if (l.status !== "active" || l.isBoosted) return false;
  if (l.publishState && l.publishState !== "live") return false;
  return nowMs - new Date(l.createdAt).getTime() >= minAgeHours * 3_600_000;
}

/** Decides whether to offer Featured on this visit, and for which ad. Once per browser session (`shownThisSession`), never for an ad offered `maxShowsPerAd` times or dismissed
 * within `quietDays`; the newest eligible ad is the one offered. Returns null when nothing should show. */
export function pickFeaturedUpsell<T extends UpsellCandidate>(input: {
  settings: Pick<FeaturedUpsellSettingsDto, "minAgeHours" | "quietDays" | "maxShowsPerAd">;
  listings: readonly T[];
  memory: (listingId: string) => FeaturedUpsellMemory;
  shownThisSession: boolean;
  nowMs: number;
}): T | null {
  if (input.shownThisSession) return null;
  const { minAgeHours, quietDays, maxShowsPerAd } = input.settings;
  const candidates = input.listings
    .filter((l) => isUpsellEligibleListing(l, minAgeHours, input.nowMs))
    .filter((l) => {
      const m = input.memory(l.id);
      if (m.shows >= maxShowsPerAd) return false;
      return m.dismissedAtMs == null || input.nowMs - m.dismissedAtMs >= quietDays * 86_400_000;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return candidates[0] ?? null;
}
