import { describe, expect, it } from "vitest";
import { pickFeaturedUpsell, type FeaturedUpsellMemory, type UpsellCandidate } from "@bhavano/types/featuredUpsell";

const NOW = Date.parse("2026-10-30T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();
const settings = { minAgeHours: 1, quietDays: 3, maxShowsPerAd: 3 };
const ad = (id: string, over: Partial<UpsellCandidate> = {}): UpsellCandidate => ({ id, status: "active", publishState: "live", isBoosted: false, createdAt: hoursAgo(48), ...over });
const noMemory = (): FeaturedUpsellMemory => ({ shows: 0, dismissedAtMs: null });

describe("pickFeaturedUpsell", () => {
  it("offers the newest eligible ad", () => {
    const pick = pickFeaturedUpsell({ settings, listings: [ad("old", { createdAt: hoursAgo(200) }), ad("new")], memory: noMemory, shownThisSession: false, nowMs: NOW });
    expect(pick?.id).toBe("new");
  });

  it("shows at most once per session", () => {
    expect(pickFeaturedUpsell({ settings, listings: [ad("a")], memory: noMemory, shownThisSession: true, nowMs: NOW })).toBeNull();
  });

  it("leaves a just-posted ad alone, and skips Featured, inactive and not-live ads", () => {
    const listings = [ad("fresh", { createdAt: hoursAgo(0.5) }), ad("featured", { isBoosted: true }), ad("sold", { status: "sold" }), ad("pending", { publishState: "pending_checkout" })];
    expect(pickFeaturedUpsell({ settings, listings, memory: noMemory, shownThisSession: false, nowMs: NOW })).toBeNull();
  });

  it("stays quiet for the quiet period after Not now, then offers again", () => {
    const dismissed = (hours: number) => (): FeaturedUpsellMemory => ({ shows: 1, dismissedAtMs: NOW - hours * 3_600_000 });
    expect(pickFeaturedUpsell({ settings, listings: [ad("a")], memory: dismissed(24), shownThisSession: false, nowMs: NOW })).toBeNull();
    expect(pickFeaturedUpsell({ settings, listings: [ad("a")], memory: dismissed(80), shownThisSession: false, nowMs: NOW })?.id).toBe("a");
  });

  it("never offers one ad more than the cap, and moves on to the next ad instead", () => {
    const memory = (id: string): FeaturedUpsellMemory => ({ shows: id === "a" ? 3 : 0, dismissedAtMs: null });
    const pick = pickFeaturedUpsell({ settings, listings: [ad("a"), ad("b", { createdAt: hoursAgo(100) })], memory, shownThisSession: false, nowMs: NOW });
    expect(pick?.id).toBe("b");
  });
});
