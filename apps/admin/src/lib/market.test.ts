import { afterEach, describe, expect, it } from "vitest";
import { adminMarket } from "./market";

describe("adminMarket", () => {
  const original = process.env.MARKET;
  afterEach(() => {
    if (original === undefined) delete process.env.MARKET;
    else process.env.MARKET = original;
  });

  it("is India unless MARKET says otherwise", () => {
    delete process.env.MARKET;
    expect(adminMarket()).toMatchObject({ id: "in", currencySymbol: "₹", locale: "en-IN", currency: "INR" });
  });

  it("is read when asked, so one image serves both", () => {
    process.env.MARKET = "us";
    expect(adminMarket()).toMatchObject({ id: "us", currencySymbol: "$", locale: "en-US", currency: "USD" });
  });
});
