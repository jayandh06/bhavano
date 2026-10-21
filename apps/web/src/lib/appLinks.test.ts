import { describe, expect, it } from "vitest";
import { androidIntentUrl, appPathForWebPath, isAndroidBrowser, playStoreUrl, androidInstallHref, isSafeReferrerPart, playInstallUrl } from "./appLinks";

describe("appPathForWebPath", () => {
  it.each([
    ["/", ""],
    ["/bengaluru/hsr-layout/rent-lease/apartment/2bhk-near-park-cmu72rr5f001401lg1ai2hiuz", "listing/cmu72rr5f001401lg1ai2hiuz"],
    ["/listings/cmu72rr5f001401lg1ai2hiuz", "listing/cmu72rr5f001401lg1ai2hiuz"],
    ["/bengaluru/hsr-layout", ""],
    ["/bengaluru/rent-lease/apartment", ""],
    ["/my-listings", "my-listings"],
    ["/my-listings/abc/edit", "my-listings/abc/edit"],
    ["/messages", "messages"],
    ["/messages/abc", "messages/abc"],
    ["/messages/new/abc", "messages/new/abc"],
    ["/favourites", "saved"],
    ["/requirements/bengaluru", "requirements"],
    ["/my-requirements/abc/refine", "my-requirements"],
    ["/post", "post"],
    ["/help", "help"],
    ["/tools/emi-calculator", ""],
    ["/cities", ""],
  ])("%s -> %p", (web, app) => {
    expect(appPathForWebPath(web)).toBe(app);
  });
});

describe("androidIntentUrl", () => {
  it("opens the bhavano scheme with a Play Store fallback carrying the referrer", () => {
    const url = androidIntentUrl("my-listings", "get_app_card", "post_success");
    expect(url.startsWith("intent://my-listings#Intent;scheme=bhavano;package=com.finfolia.bhavano;")).toBe(true);
    expect(url.endsWith(";end")).toBe(true);
    const fallback = decodeURIComponent(/S\.browser_fallback_url=([^;]+)/.exec(url)![1]);
    expect(fallback).toBe(playStoreUrl("get_app_card", "post_success"));
    expect(new URL(fallback).searchParams.get("referrer")).toBe(
      "utm_source=bhavano_web&utm_medium=get_app_card&utm_campaign=post_success",
    );
  });
});

describe("isAndroidBrowser", () => {
  it("accepts Android Chrome and rejects WebViews and desktop", () => {
    expect(isAndroidBrowser("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/128.0 Mobile Safari/537.36")).toBe(true);
    expect(isAndroidBrowser("Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 Chrome/128.0 Mobile Safari/537.36 [FBAN/EMA]")).toBe(false);
    expect(isAndroidBrowser("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36")).toBe(false);
  });
});

describe("playInstallUrl / androidInstallHref", () => {
  const ws = "3f2b8e8b-d4d7-4d96-86e3-019592af7a0d";

  it("adds the website session to the install referrer when there is one", () => {
    const url = playInstallUrl("header_link", "header", ws);
    const referrer = decodeURIComponent(new URL(url).searchParams.get("referrer") ?? "");
    expect(referrer).toBe(`utm_source=bhavano_web&utm_medium=header_link&utm_campaign=header&ws=${ws}`);
  });

  it("is exactly the usual Play link when there is no session, or the value is not a UUID", () => {
    expect(playInstallUrl("header_link", "header")).toBe(playStoreUrl("header_link", "header"));
    expect(playInstallUrl("header_link", "header", "not-a-uuid&evil=1")).toBe(playStoreUrl("header_link", "header"));
  });

  it("points the site's buttons at the /android redirect", () => {
    expect(androidInstallHref("play_badge", "post_success")).toBe("/android?m=play_badge&c=post_success");
  });

  it("only accepts plain identifiers for the referrer parts", () => {
    expect(isSafeReferrerPart("play_icon")).toBe(true);
    expect(isSafeReferrerPart("a b")).toBe(false);
    expect(isSafeReferrerPart("x&ws=1")).toBe(false);
    expect(isSafeReferrerPart(null)).toBe(false);
  });
});
