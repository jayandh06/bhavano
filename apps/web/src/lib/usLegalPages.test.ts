import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// The real layout pulls in the site header and footer (server-only code); only the page text is under test.
vi.mock("@/components/home/StaticPageLayout", () => ({
  StaticPageLayout: ({ children }: { children: unknown }) => children,
  PageSection: ({ heading, children }: { heading: string; children: unknown }) => [heading, children],
}));
import { UsTerms } from "@/components/legal/UsTerms";
import { UsPrivacy } from "@/components/legal/UsPrivacy";
import { UsAbout } from "@/components/legal/UsAbout";
import { UsTrust } from "@/components/legal/UsTrust";

// Words that must not appear on a US legal page: India's law, its tax and telecom rules, its payment processor, OTP sign-in and moderation claims the US stack does not back.
const INDIA_ONLY = /India's|Indian|DPDP|Digital Personal Data|GST|DLT|Razorpay|MSG91|data fiduciary|₹|lakh|crore|\bPG\b|coworking|\bplots?\b|Meta Pixel|one-time code|OTP|checked before|automated checks/i;
// The entity sentence says the operator is "registered in India", which is true and wanted, so strip it before scanning.
const strip = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/registered in India/g, "").replace(/\s+/g, " ");

describe("US legal pages", () => {
  const pages = { terms: UsTerms, privacy: UsPrivacy, about: UsAbout, trust: UsTrust };

  for (const [name, Page] of Object.entries(pages)) {
    it(`${name} names no India-only law, provider or claim`, () => {
      const text = strip(renderToStaticMarkup(createElement(Page)));
      expect(text.match(INDIA_ONLY)?.[0]).toBeUndefined();
    });
  }

  it("terms and privacy are marked as drafts, and terms carry the fair housing notice", () => {
    expect(strip(renderToStaticMarkup(createElement(UsTerms)))).toContain("Draft.");
    expect(strip(renderToStaticMarkup(createElement(UsPrivacy)))).toContain("Draft.");
    expect(strip(renderToStaticMarkup(createElement(UsTerms)))).toContain("Equal Housing Opportunity");
  });

  it("names the operator entity", () => {
    for (const Page of [UsTerms, UsPrivacy, UsAbout]) expect(strip(renderToStaticMarkup(createElement(Page)))).toContain("Finfolia Technologies LLP");
  });
});

describe("Help page FAQs", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function helpText(market: string): Promise<string> {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_MARKET", market);
    const { default: HelpPage } = await import("@/app/help/page");
    return strip(renderToStaticMarkup(createElement(HelpPage)));
  }

  it("US: Google-only sign-in and no listing-check claims", async () => {
    const text = await helpText("us");
    expect(text).toContain("Continue with Google");
    expect(text).not.toMatch(/Phone\s+OTP|one-time code|automated checks|checked before they go live|duplicate-photo/i);
    expect(text).toContain("not checked before they appear");
    expect(text).not.toContain("verify a phone number");
  });

  it("India: unchanged, with Phone OTP and the automated-checks answer", async () => {
    const text = await helpText("");
    expect(text).toMatch(/Phone\s+OTP/);
    expect(text).toContain("Listings are checked before they go live");
    expect(text).toContain("Every listing goes through automated checks before it goes live");
  });
});
