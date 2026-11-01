import { describe, expect, it } from "vitest";
import { isAdClick, parseAcquisitionCookie, shouldReplaceAcquisition } from "./acquisitionCookie";

const direct = JSON.stringify({ source: "direct" });
const organic = JSON.stringify({ source: "www.google.com", medium: "referral" });
const googleAd = JSON.stringify({ source: "google", medium: "cpc", gclid: "abc", campaignId: "24196652086" });
const metaAd = JSON.stringify({ source: "facebook", medium: "paid_social" });

describe("isAdClick", () => {
  it("recognises a Google click id and the paid mediums", () => {
    expect(isAdClick({ source: "google", medium: "cpc", gclid: "x" })).toBe(true);
    expect(isAdClick({ source: "google", gclid: "x" })).toBe(true);
    expect(isAdClick({ source: "facebook", medium: "paid_social" })).toBe(true);
    expect(isAdClick({ source: "google", medium: "cpc" })).toBe(true);
  });

  it("does not count direct, referral or organic landings", () => {
    expect(isAdClick({ source: "direct" })).toBe(false);
    expect(isAdClick({ source: "www.google.com", medium: "referral" })).toBe(false);
    expect(isAdClick({ source: "google", medium: "organic" })).toBe(false);
    expect(isAdClick(null)).toBe(false);
  });
});

describe("parseAcquisitionCookie", () => {
  it("reads valid JSON and gives up quietly on anything else", () => {
    expect(parseAcquisitionCookie(googleAd)?.gclid).toBe("abc");
    expect(parseAcquisitionCookie("not json")).toBeNull();
    expect(parseAcquisitionCookie("")).toBeNull();
    expect(parseAcquisitionCookie(undefined)).toBeNull();
    expect(parseAcquisitionCookie("123")).toBeNull();
  });
});

describe("shouldReplaceAcquisition", () => {
  const adLanding = { source: "google", medium: "cpc", gclid: "new" };

  it("replaces a direct, referral or unreadable cookie when the visitor arrives from an ad", () => {
    expect(shouldReplaceAcquisition(direct, adLanding)).toBe(true);
    expect(shouldReplaceAcquisition(organic, adLanding)).toBe(true);
    expect(shouldReplaceAcquisition("garbage", adLanding)).toBe(true);
  });

  it("keeps the first ad click", () => {
    expect(shouldReplaceAcquisition(googleAd, adLanding)).toBe(false);
    expect(shouldReplaceAcquisition(metaAd, adLanding)).toBe(false);
  });

  it("never replaces anything with a non-ad landing", () => {
    expect(shouldReplaceAcquisition(direct, { source: "direct" })).toBe(false);
    expect(shouldReplaceAcquisition(googleAd, { source: "direct" })).toBe(false);
  });
});
