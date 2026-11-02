import { describe, expect, it } from "vitest";
import { listingAttributeIssues } from "@bhavano/types/categoryFields";
import { DESCRIPTION_MAX_LENGTH, DESCRIPTION_MIN_LENGTH, TITLE_MAX_LENGTH, TITLE_MIN_LENGTH } from "@bhavano/types/listingLimits";
import { listingPriceIssue } from "@bhavano/types/priceBounds";
import { POSTABLE_TRANSACTION_TYPES } from "@bhavano/types/postingRules";
import { postAdScenarios, scenarioAttributes, scenarioById, scenarioCopy, scenarioPrice, scenarioQualifier } from "./postAdScenarios";

describe("post-ad test scenarios", () => {
  const scenarios = postAdScenarios();

  it("covers every postable category and transaction type, plus the edge cases, with unique ids", () => {
    for (const [category, types] of Object.entries(POSTABLE_TRANSACTION_TYPES)) {
      for (const type of types) expect(scenarios.some((s) => s.category === category && s.transactionType === type && s.variant === "standard")).toBe(true);
    }
    expect(new Set(scenarios.map((s) => s.id)).size).toBe(scenarios.length);
    expect(scenarioById("apartment-rent-long_text")).toBeDefined();
  });

  it.each(scenarios.map((s) => [s.id, s] as const))("%s passes the form's own checks", (_id, s) => {
    const price = scenarioPrice(s.category, s.transactionType, s.variant);
    const attributes = scenarioAttributes(s.category, s.transactionType, s.variant);
    // Same validators the details step and the server use: no attribute problem, the price in range, copy within the limits.
    expect(listingAttributeIssues(s.category, s.transactionType, attributes, price)).toEqual([]);
    expect(listingPriceIssue(s.category, s.transactionType, price)).toBeNull();
    const { title, description } = scenarioCopy(s, "Koramangala");
    expect(title.length).toBeGreaterThanOrEqual(TITLE_MIN_LENGTH);
    expect(title.length).toBeLessThanOrEqual(TITLE_MAX_LENGTH);
    expect(description.length).toBeGreaterThanOrEqual(DESCRIPTION_MIN_LENGTH);
    expect(description.length).toBeLessThanOrEqual(DESCRIPTION_MAX_LENGTH);
    expect(title.startsWith("[TEST]")).toBe(true);
    expect(typeof scenarioQualifier(s.category, s.transactionType)).toBe("string");
  });

  it("makes the long-text scenario use the full title and description length", () => {
    const s = scenarioById("apartment-rent-long_text")!;
    const { title, description } = scenarioCopy(s, "Koramangala");
    expect(title.length).toBe(TITLE_MAX_LENGTH);
    expect(description.length).toBeGreaterThan(DESCRIPTION_MAX_LENGTH - 100);
  });

  it("uses the lowest and highest allowed price for the price edge cases", () => {
    expect(scenarioPrice("apartment", "sell", "high_price")).toBe(500_000_000);
    expect(scenarioPrice("apartment", "rent", "low_price")).toBe(1_000);
  });

  it("fills fewer fields in the minimal variant than the standard one", () => {
    const standard = Object.keys(scenarioAttributes("apartment", "rent", "standard")).length;
    const minimal = Object.keys(scenarioAttributes("apartment", "rent", "minimal")).length;
    expect(minimal).toBeLessThan(standard);
  });
});
