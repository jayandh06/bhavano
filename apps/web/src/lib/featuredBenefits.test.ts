import { describe, expect, it } from "vitest";
import { FEATURED_BENEFITS, FEATURED_LEAD_CONTACT_BENEFIT, featuredBenefits } from "@bhavano/types/featuredBenefits";

describe("featuredBenefits", () => {
  it("never promises interested people's numbers while the feature is off", () => {
    expect(featuredBenefits(false)).toEqual(FEATURED_BENEFITS);
    expect(featuredBenefits(false)).not.toContain(FEATURED_LEAD_CONTACT_BENEFIT);
  });

  it("leads with the number benefit while the feature is on, keeping every other line", () => {
    const on = featuredBenefits(true);
    expect(on[0]).toBe(FEATURED_LEAD_CONTACT_BENEFIT);
    expect(on.slice(1)).toEqual(FEATURED_BENEFITS);
  });
});
