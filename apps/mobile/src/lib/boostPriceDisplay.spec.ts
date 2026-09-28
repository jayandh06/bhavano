import { priceSuffix, type PriceLike } from "./boostPriceDisplay";

function option(overrides: Partial<PriceLike> = {}): PriceLike {
  return { amount: 99, originalAmount: 99, discountApplied: false, free: false, ...overrides };
}

describe("priceSuffix", () => {
  it("returns an empty string when there's nothing to show yet", () => {
    expect(priceSuffix(undefined)).toBe("");
  });

  it("shows Free for a free option regardless of amount", () => {
    expect(priceSuffix(option({ free: true, amount: 0, originalAmount: 0 }))).toBe(" — Free");
  });

  it("shows a plain price when no discount applies", () => {
    expect(priceSuffix(option({ amount: 99, originalAmount: 99 }))).toBe(" — ₹99");
  });

  it("shows the struck-through original alongside the discounted price", () => {
    expect(priceSuffix(option({ amount: 49, originalAmount: 99, discountApplied: true }))).toBe(
      " — ₹99 → ₹49",
    );
  });

  it("falls back to a plain price if discountApplied is true but the amounts are equal", () => {
    // A discount code that resolves to 0% off, or one already fully consumed — showing "₹99 →
    // ₹99" would look like a broken discount rather than no discount at all.
    expect(priceSuffix(option({ amount: 99, originalAmount: 99, discountApplied: true }))).toBe(" — ₹99");
  });
});
