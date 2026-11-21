import { describe, expect, it } from "vitest";
import { siteMetaOther } from "./smartAppBanner";

describe("siteMetaOther", () => {
  it("is the plain banner with the site tags when there is no page URL", () => {
    const other = siteMetaOther();
    expect(other["apple-itunes-app"]).toBe("app-id=6811878602");
    expect(other["facebook-domain-verification"]).toBeTruthy();
  });

  it("adds the page's own URL as the app-argument, keeping the site tags", () => {
    const other = siteMetaOther("https://www.bhavano.com/bengaluru/hsr-layout/rent/apartments/2-bhk-abc");
    expect(other["apple-itunes-app"]).toBe("app-id=6811878602, app-argument=https://www.bhavano.com/bengaluru/hsr-layout/rent/apartments/2-bhk-abc");
    expect(other["facebook-domain-verification"]).toBeTruthy();
  });
});
