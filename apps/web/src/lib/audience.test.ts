import { describe, expect, it } from "vitest";
import { audienceFor } from "@bhavano/types/audience";

describe("audienceFor", () => {
  it("says buyers for property sold and tenants for property rented or leased", () => {
    expect(audienceFor("apartment", "sell")).toBe("buyers");
    expect(audienceFor("plot", "buy")).toBe("buyers");
    expect(audienceFor("house", "rent")).toBe("tenants");
    expect(audienceFor("commercial", "lease")).toBe("tenants");
  });

  it("uses the category's own audience where the transaction type does not matter", () => {
    expect(audienceFor("pg", "rent")).toBe("people looking for a PG");
    expect(audienceFor("coworking", "rent")).toBe("teams and freelancers");
    expect(audienceFor("storage", "rent")).toBe("people looking for storage");
    expect(audienceFor("interiors", "sell")).toBe("customers");
    expect(audienceFor("furniture", "sell")).toBe("buyers");
  });

  it("falls back to a neutral word when it cannot tell", () => {
    expect(audienceFor(null)).toBe("people");
    expect(audienceFor("apartment")).toBe("people");
  });
});
