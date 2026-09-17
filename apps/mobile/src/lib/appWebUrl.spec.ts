import { appWebUrl } from "./appWebUrl";

describe("appWebUrl", () => {
  it("tags a plain path with app=1", () => {
    expect(appWebUrl("/my-listings")).toBe("https://bhavano.com/my-listings?app=1");
  });

  it("appends with & when the path already carries a query string", () => {
    expect(appWebUrl("/my-listings?openBoost=123")).toBe(
      "https://bhavano.com/my-listings?openBoost=123&app=1",
    );
  });

  it("respects EXPO_PUBLIC_SITE_URL when set", () => {
    const prev = process.env.EXPO_PUBLIC_SITE_URL;
    process.env.EXPO_PUBLIC_SITE_URL = "https://staging.bhavano.com";
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-var-requires -- re-require after env change
    const { appWebUrl: appWebUrlWithEnv } = require("./appWebUrl");
    expect(appWebUrlWithEnv("/post")).toBe("https://staging.bhavano.com/post?app=1");
    process.env.EXPO_PUBLIC_SITE_URL = prev;
  });
});
