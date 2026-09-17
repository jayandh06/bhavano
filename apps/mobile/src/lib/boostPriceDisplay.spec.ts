import type { BoostPricingPreviewDto } from "@bhavano/types";
import { instantAlertsOnlyPrice, priceSuffix, type PriceLike } from "./boostPriceDisplay";

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

function pricing(overrides: Partial<BoostPricingPreviewDto> = {}): BoostPricingPreviewDto {
  const base: BoostPricingPreviewDto = {
    boost7: option({ amount: 99, originalAmount: 99 }),
    boost15: option({ amount: 149, originalAmount: 149 }),
    boost7WithInstantAlerts: option({ amount: 124, originalAmount: 124 }),
    boost15WithInstantAlerts: option({ amount: 174, originalAmount: 174 }),
  };
  return { ...base, ...overrides };
}

describe("instantAlertsOnlyPrice", () => {
  it("returns null when there's no pricing yet", () => {
    expect(instantAlertsOnlyPrice(null)).toBeNull();
  });

  it("derives the alerts-only increment as the bundle minus the standalone boost price", () => {
    const result = instantAlertsOnlyPrice(pricing());
    expect(result).toEqual({ amount: 25, originalAmount: 25, discountApplied: false, free: false });
  });

  it("carries the bundle's own discountApplied flag through", () => {
    const result = instantAlertsOnlyPrice(
      pricing({
        boost7: option({ amount: 50, originalAmount: 99, discountApplied: true }),
        boost7WithInstantAlerts: option({ amount: 62, originalAmount: 124, discountApplied: true }),
      }),
    );
    expect(result).toEqual({ amount: 12, originalAmount: 25, discountApplied: true, free: false });
  });

  it("returns null (never a misleading number) when the standalone boost is free via an Agent Pro credit", () => {
    // Bundling with Instant Alerts deliberately bypasses the free credit, so
    // boost7WithInstantAlerts.amount - boost7.amount here would equal the whole bundle price,
    // not the alerts increment — see this function's own doc comment.
    const result = instantAlertsOnlyPrice(
      pricing({
        boost7: option({ amount: 0, originalAmount: 0, free: true }),
        boost7WithInstantAlerts: option({ amount: 25, originalAmount: 25, free: false }),
      }),
    );
    expect(result).toBeNull();
  });

  it("returns null when the bundle itself is free", () => {
    const result = instantAlertsOnlyPrice(
      pricing({ boost7WithInstantAlerts: option({ amount: 0, originalAmount: 0, free: true }) }),
    );
    expect(result).toBeNull();
  });
});
