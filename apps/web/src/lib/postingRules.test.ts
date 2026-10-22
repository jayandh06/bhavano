import { describe, expect, it } from "vitest";
import { POSTABLE_TRANSACTION_TYPES } from "@bhavano/types/postingRules";

/** The post wizard's first screen asks "sell, rent out or lease out?" and then lists only the categories
 * that can be posted that way. These checks protect that screen from a rules change that would leave it with
 * an empty list or a category nobody can reach. */
const INTENTS = ["sell", "rent", "lease"] as const;

describe("posting rules behind the intent-first screen", () => {
  it("offers at least one category for every intent", () => {
    for (const intent of INTENTS) {
      const categories = Object.entries(POSTABLE_TRANSACTION_TYPES).filter(([, types]) => types.includes(intent));
      expect(categories.length, intent).toBeGreaterThan(0);
    }
  });

  it("lets every category be reached from at least one intent, and never posts a 'buy'", () => {
    for (const [category, types] of Object.entries(POSTABLE_TRANSACTION_TYPES)) {
      expect(types.length, category).toBeGreaterThan(0);
      expect(types.some((t) => (INTENTS as readonly string[]).includes(t)), category).toBe(true);
      expect(types, category).not.toContain("buy");
    }
  });

  it("keeps plots sale-only and PG rent-only, which the screen relies on to skip the second question", () => {
    expect(POSTABLE_TRANSACTION_TYPES.plot).toEqual(["sell"]);
    expect(POSTABLE_TRANSACTION_TYPES.pg).toEqual(["rent"]);
  });
});
