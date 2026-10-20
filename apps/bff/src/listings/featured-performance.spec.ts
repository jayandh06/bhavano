import { buildFeaturedPerformance, perDay } from "@bhavano/types/featuredPerformance";

describe("buildFeaturedPerformance", () => {
  const created = new Date("2026-10-01T00:00:00Z");
  const from = new Date("2026-10-05T00:00:00Z");
  const zero = { views: 0, enquiries: 0, contactReveals: 0 };

  it("is active and counts days up to now while the boost runs", () => {
    const dto = buildFeaturedPerformance({
      boostedFrom: from,
      boostedUntil: new Date("2026-10-20T00:00:00Z"),
      listingCreatedAt: created,
      now: new Date("2026-10-07T12:00:00Z"),
      during: { views: 30, enquiries: 3, contactReveals: 1 },
      beforeCounts: { views: 8, enquiries: 1, contactReveals: 0 },
    });
    expect(dto.active).toBe(true);
    expect(dto.daysFeatured).toBe(2.5);
    expect(dto.views).toBe(30);
    expect(dto.before).toEqual({ days: 4, views: 8, enquiries: 1, contactReveals: 0 });
  });

  it("caps days at the boost end once it has expired", () => {
    const dto = buildFeaturedPerformance({
      boostedFrom: from,
      boostedUntil: new Date("2026-10-12T00:00:00Z"),
      listingCreatedAt: created,
      now: new Date("2026-10-30T00:00:00Z"),
      during: zero,
      beforeCounts: zero,
    });
    expect(dto.active).toBe(false);
    expect(dto.daysFeatured).toBe(7);
  });

  it("omits the 'before' comparison when the ad was boosted within a day of posting", () => {
    const dto = buildFeaturedPerformance({
      boostedFrom: new Date("2026-10-01T00:10:00Z"),
      boostedUntil: new Date("2026-10-16T00:10:00Z"),
      listingCreatedAt: created,
      now: new Date("2026-10-02T00:00:00Z"),
      during: zero,
      beforeCounts: zero,
    });
    expect(dto.before).toBeNull();
  });
});

describe("perDay", () => {
  it("rounds to one decimal and is 0 for no time span", () => {
    expect(perDay(10, 4)).toBe(2.5);
    expect(perDay(5, 0)).toBe(0);
  });
});
