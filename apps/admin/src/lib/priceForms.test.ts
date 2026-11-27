import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_BOOST_PRICE_SETTINGS, US_BOOST_PRICE_SETTINGS } from "@bhavano/types/boostPricing";
import { DEFAULT_PLATFORM_FEE_SETTINGS } from "@bhavano/types/platformFeePricing";
import { DEFAULT_SUBSCRIPTION_PLAN_SETTINGS } from "@bhavano/types/subscriptionPricing";
import { BoostPricingSettingsForm } from "@/components/BoostPricingSettingsForm";
import { PlatformFeeSettingsForm } from "@/components/PlatformFeeSettingsForm";
import { SubscriptionPlanSettingsForm } from "@/components/SubscriptionPlanSettingsForm";

// The save buttons call server actions, which need a running Next server.
vi.mock("@/app/actions/admin", () => ({}));

describe("price screens in each market", () => {
  const india = () =>
    [
      createElement(BoostPricingSettingsForm, { initial: DEFAULT_BOOST_PRICE_SETTINGS, marketId: "in" }),
      createElement(PlatformFeeSettingsForm, { initial: DEFAULT_PLATFORM_FEE_SETTINGS, marketId: "in" }),
      createElement(SubscriptionPlanSettingsForm, { initial: DEFAULT_SUBSCRIPTION_PLAN_SETTINGS, currency: "₹" }),
    ].map((form) => renderToStaticMarkup(form));
  const us = () =>
    [
      createElement(BoostPricingSettingsForm, { initial: US_BOOST_PRICE_SETTINGS, marketId: "us" }),
      createElement(PlatformFeeSettingsForm, { initial: DEFAULT_PLATFORM_FEE_SETTINGS, marketId: "us" }),
      createElement(SubscriptionPlanSettingsForm, { initial: DEFAULT_SUBSCRIPTION_PLAN_SETTINGS, currency: "$" }),
    ].map((form) => renderToStaticMarkup(form));

  it("uses dollars and the US categories in the US, with no rupee sign anywhere", () => {
    const [boost, fee, plans] = us();
    for (const html of [boost, fee, plans]) expect(html).not.toContain("₹");
    expect(boost).toContain("7-day Feature ($)");
    expect(boost).toContain("Condo / Townhouse");
    expect(boost).not.toContain("Furniture");
    expect(boost).not.toContain("Price bands by listing value");
    expect(fee).toContain("Platform fee ($)");
    expect(plans).toContain("1 month ($)");
  });

  it("keeps India's screens as they were", () => {
    const [boost, fee, plans] = india();
    for (const html of [boost, fee, plans]) expect(html).not.toContain("($)");
    expect(boost).toContain("7-day Feature (₹)");
    expect(boost).toContain("House / Apartment / Villa / Plot / Commercial");
    expect(boost).toContain("Coworking / PG / Storage");
    expect(boost).toContain("Furniture / Interiors");
    expect(boost).toContain("Price bands by listing value");
    expect(boost).toContain("Up to (₹)");
    expect(fee).toContain("greater than ₹");
    expect(plans).toContain("1 month (₹)");
  });
});
