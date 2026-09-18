import { parseAmount } from "./priceInput";

describe("parseAmount", () => {
  it("parses plain digits", () => {
    expect(parseAmount("20000")).toBe(20000);
  });

  it("parses shorthand suffixes", () => {
    expect(parseAmount("20k")).toBe(20_000);
    expect(parseAmount("2L")).toBe(200_000);
    expect(parseAmount("1.5Cr")).toBe(15_000_000);
  });

  it("accepts commas, spaces and a leading ₹", () => {
    expect(parseAmount("₹1,00,000")).toBe(100_000);
    expect(parseAmount(" 20 k ")).toBe(20_000);
  });

  it("returns undefined for empty, unparsable, or non-positive/fractional-rupee input", () => {
    expect(parseAmount("")).toBeUndefined();
    expect(parseAmount("abc")).toBeUndefined();
    expect(parseAmount("-5")).toBeUndefined();
    expect(parseAmount("0")).toBeUndefined();
    expect(parseAmount("2.5")).toBeUndefined();
  });
});
