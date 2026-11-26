jest.mock("@react-native-async-storage/async-storage", () => ({ getItem: jest.fn(), setItem: jest.fn(), multiSet: jest.fn() }));

import {
  MARKET_SWITCH_ENABLED,
  appRouteFor,
  parseMarketLink,
  routeSystemPath,
  setPendingLink,
  switchMarketRoute,
  takePendingLink,
} from "./marketLinks";

const ID = "cmu72rr5f001401lg1ai2hiuz";
const IN_LISTING = `https://www.bhavano.com/bengaluru/hsr-layout/rent-lease/apartment/2bhk-${ID}`;
const US_LISTING = `https://www.bhavano.com/us/austin-tx/downtown/rent-lease/apartment/2-bed-${ID}`;

describe("which market a link belongs to", () => {
  it.each([
    [IN_LISTING, "in"],
    ["https://bhavano.com/help", "in"],
    ["www.bhavano.com/usha-nagar", "in"],
    [US_LISTING, "us"],
    ["https://www.bhavano.com/us", "us"],
    ["bhavano.com/us?ref=abc", "us"],
    ["/us/help", "us"],
    [`bhavano://listing/${ID}?market=us`, "us"],
    ["bhavano://?market=us", "us"],
    [`bhavano://listing/${ID}`, "in"],
    ["bhavano://", "in"],
  ])("%s -> %s", (url, market) => {
    expect(parseMarketLink(url)?.market).toBe(market);
  });

  it.each([
    "bhavano://oauthredirect?code=x",
    "com.googleusercontent.apps.123:/oauthredirect?code=x",
    "https://example.com/us/help",
    "https://www.bhavano.com.evil.test/us",
    "/help",
  ])("says nothing about %s", (url) => {
    expect(parseMarketLink(url)).toBeNull();
  });

  it("gives the page to open in a browser", () => {
    expect(parseMarketLink(US_LISTING)?.webUrl).toBe(US_LISTING);
    expect(parseMarketLink("bhavano.com/us/help")?.webUrl).toBe("https://bhavano.com/us/help");
    expect(parseMarketLink(`bhavano://listing/${ID}?market=us`)?.webUrl).toBe(`https://www.bhavano.com/us/listings/${ID}`);
    expect(parseMarketLink("bhavano://saved?market=us")?.webUrl).toBe("https://www.bhavano.com/us/favourites");
    expect(parseMarketLink("bhavano://?market=us")?.webUrl).toBe("https://www.bhavano.com/us");
  });
});

describe("where a link opens", () => {
  it("leaves India's own links as they were", () => {
    for (const url of [IN_LISTING, "https://www.bhavano.com/help", `bhavano://listing/${ID}`, "bhavano://oauthredirect?code=x"]) {
      expect(routeSystemPath(url, "in")).toBe(url);
    }
  });

  it("opens a shared listing address on the listing screen", () => {
    expect(routeSystemPath(`https://bhavano.com/listings/${ID}?utm_source=app_share`, "in")).toBe(`/listing/${ID}`);
    expect(routeSystemPath(`https://www.bhavano.com/us/listings/${ID}`, "us")).toBe(`/listing/${ID}`);
  });

  it("drops /us for the router in the US", () => {
    expect(routeSystemPath("https://www.bhavano.com/us/help?x=1", "us")).toBe("/help?x=1");
    expect(routeSystemPath("https://www.bhavano.com/us", "us")).toBe("/");
    expect(routeSystemPath(`bhavano://listing/${ID}?market=us`, "us")).toBe(`bhavano://listing/${ID}?market=us`);
  });

  it("sends the other market's link to the switch screen, both ways", () => {
    const cases = [
      [US_LISTING, "in"],
      [`bhavano://listing/${ID}?market=us`, "in"],
      [IN_LISTING, "us"],
      [`bhavano://listing/${ID}`, "us"],
    ] as const;
    for (const [url, current] of cases) expect(routeSystemPath(url, current)).toBe(switchMarketRoute(url));
  });

  it.each([
    ["/", "/"],
    [`/listings/${ID}`, `/listing/${ID}`],
    [`/austin-tx/downtown/rent-lease/apartment/2-bed-${ID}`, `/listing/${ID}`],
    ["/austin-tx", "/"],
    ["/favourites", "/saved"],
    ["/messages/new/abc", "/messages/new/abc"],
    ["/my-listings/abc/edit", "/my-listings/abc/edit"],
    ["/help", "/help"],
    ["/admin", "/"],
  ])("the screen for %s is %s", (path, route) => {
    expect(appRouteFor(path)).toBe(route);
  });
});

describe("a link followed into another market", () => {
  it("is kept once", () => {
    setPendingLink(US_LISTING);
    expect(takePendingLink()).toBe(US_LISTING);
    expect(takePendingLink()).toBeNull();
  });

  it("cannot switch the app yet: the switch ships with the Country setting", () => {
    expect(MARKET_SWITCH_ENABLED).toBe(false);
  });
});
