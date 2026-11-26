import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MarketFlag } from "@/components/home/MarketFlag";

const html = (marketId?: string) => renderToStaticMarkup(createElement(MarketFlag, { marketId }));

describe("MarketFlag", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is India's flag for India and when nothing names a market", () => {
    vi.stubEnv("NEXT_PUBLIC_MARKET", "");
    vi.stubEnv("MARKET", "");
    for (const out of [html(), html("in")]) {
      expect(out).toContain('aria-label="India"');
      expect(out).toContain("#ff9933");
      expect(out).not.toContain("#b22234");
    }
  });

  it("is the US flag on the US build, with all 50 stars", () => {
    vi.stubEnv("NEXT_PUBLIC_MARKET", "us");
    const out = html();
    expect(out).toContain('aria-label="United States"');
    expect(out).not.toContain("#ff9933");
    expect(out.match(/<circle/g)).toHaveLength(50);
  });
});
