import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { androidRedirect, appRedirect, iosRedirect } from "./appStoreRedirect";

const ws = "3f2b8e8b-d4d7-4d96-86e3-019592af7a0d";

function referrerOf(response: Response): string {
  const location = new URL(response.headers.get("location") ?? "");
  return decodeURIComponent(location.searchParams.get("referrer") ?? "");
}

describe("iosRedirect and appRedirect", () => {
  it("sends /ios to the App Store with a campaign token", () => {
    const response = iosRedirect(new NextRequest("https://www.bhavano.com/ios?m=app_store_badge&c=footer"));
    const location = new URL(response.headers.get("location") ?? "");
    expect(response.status).toBe(302);
    expect(location.hostname).toBe("apps.apple.com");
    expect(location.pathname).toBe("/app/id6811878602");
    expect(location.searchParams.get("ct")).toBe("app_store_badge-footer");
  });

  it("falls back to a generic token for missing or unsafe params", () => {
    const bare = iosRedirect(new NextRequest("https://www.bhavano.com/ios"));
    expect(new URL(bare.headers.get("location") ?? "").searchParams.get("ct")).toBe("sms-ios-link");
    const unsafe = iosRedirect(new NextRequest("https://www.bhavano.com/ios?m=a%26b&c=footer"));
    expect(new URL(unsafe.headers.get("location") ?? "").searchParams.get("ct")).toBe("sms-ios-link");
  });

  it("routes /app by device", () => {
    const go = (ua: string) =>
      new URL(appRedirect(new NextRequest("https://www.bhavano.com/app", { headers: { "user-agent": ua } })).headers.get("location") ?? "").hostname;
    expect(go("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe("apps.apple.com");
    expect(go("Mozilla/5.0 (Linux; Android 14; Pixel 8)")).toBe("play.google.com");
    expect(go("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).not.toMatch(/apple|google/);
  });
});

describe("androidRedirect", () => {
  it("keeps the SMS link exactly as it was when called without button params", () => {
    const response = androidRedirect(new NextRequest("https://www.bhavano.com/android"));
    expect(response.status).toBe(302);
    expect(referrerOf(response)).toBe("utm_source=sms&utm_medium=outreach&utm_campaign=android-link");
  });

  it("adds the visitor's website session to the referrer for the site's own buttons", () => {
    const request = new NextRequest("https://www.bhavano.com/android?m=header_link&c=header", {
      headers: { cookie: `bhavano_sid=${ws}` },
    });
    const response = androidRedirect(request);
    expect(response.status).toBe(302);
    expect(new URL(response.headers.get("location") ?? "").hostname).toBe("play.google.com");
    expect(referrerOf(response)).toBe(`utm_source=bhavano_web&utm_medium=header_link&utm_campaign=header&ws=${ws}`);
  });

  it("still redirects with the usual referrer when there is no session cookie", () => {
    const response = androidRedirect(new NextRequest("https://www.bhavano.com/android?m=play_badge&c=footer"));
    expect(referrerOf(response)).toBe("utm_source=bhavano_web&utm_medium=play_badge&utm_campaign=footer");
  });

  it("ignores a cookie that is not a UUID, and unsafe medium/campaign values", () => {
    const junkCookie = androidRedirect(
      new NextRequest("https://www.bhavano.com/android?m=header_link&c=header", { headers: { cookie: "bhavano_sid=abc&x=1" } }),
    );
    expect(referrerOf(junkCookie)).not.toContain("ws=");

    const unsafe = androidRedirect(new NextRequest("https://www.bhavano.com/android?m=a%26ws%3D1&c=header"));
    expect(referrerOf(unsafe)).toBe("utm_source=sms&utm_medium=outreach&utm_campaign=android-link");
  });
});
