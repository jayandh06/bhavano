import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_SUBSCRIPTION_PLAN_SETTINGS } from "@bhavano/types/subscriptionPricing";

// The plans table shows prices in the build's currency: the rupee in India, the dollar in the US build. Rendered as the server renders it.
// (The server-only rule it must follow, no client hooks, cannot be tested here: in plain Node a client hook is just a function. That is covered by
// the Playwright smoke test e2e/premium.spec.ts, which runs against a real Next server.)
async function renderTable(env: Record<string, string>): Promise<string> {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  const { PlanComparisonTable } = await import("../components/home/PlanComparisonTable");
  return renderToStaticMarkup(
    createElement(PlanComparisonTable, {
      profile: null,
      contactRevealSettings: { freeRevealsPerUser: 3, creditPackSize: 10, creditPackPriceRupees: 99, creditExpiryMonths: 6 },
      planPricing: DEFAULT_SUBSCRIPTION_PLAN_SETTINGS,
    }),
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("PlanComparisonTable on the server", () => {
  it("renders for India with the rupee symbol", async () => {
    const html = await renderTable({ NEXT_PUBLIC_MARKET: "" });
    expect(html).toContain("Selling");
    expect(html).toContain("₹");
  });

  it("renders for the US build with the dollar symbol and no rupee", async () => {
    const html = await renderTable({ NEXT_PUBLIC_MARKET: "us" });
    expect(html).toContain("Selling");
    expect(html).toContain("$");
    expect(html).not.toContain("₹");
  });
});
