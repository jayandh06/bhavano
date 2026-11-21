import { describe, expect, it } from "vitest";
import { resolveDeviceFilter } from "./pageVisitDeviceFilter";

describe("resolveDeviceFilter", () => {
  it("passes plain device types through", () => {
    expect(resolveDeviceFilter("mobile", undefined)).toEqual({ deviceType: "mobile", os: undefined });
    expect(resolveDeviceFilter("mobile_app", "any")).toEqual({ deviceType: "mobile_app", os: undefined });
  });

  it("splits a mobile browser pick by OS", () => {
    expect(resolveDeviceFilter("mobile:ios", undefined)).toEqual({ deviceType: "mobile", os: "ios" });
    expect(resolveDeviceFilter("mobile:android", undefined)).toEqual({ deviceType: "mobile", os: "android" });
    expect(resolveDeviceFilter("mobile:other", undefined)).toEqual({ deviceType: "mobile", os: "unknown" });
  });

  it("splits the mobile app by OS the same way", () => {
    expect(resolveDeviceFilter("mobile_app:ios", undefined)).toEqual({ deviceType: "mobile_app", os: "ios" });
    expect(resolveDeviceFilter("mobile_app:android", undefined)).toEqual({ deviceType: "mobile_app", os: "android" });
    expect(resolveDeviceFilter("mobile_app:other", undefined)).toEqual({ deviceType: "mobile_app", os: "unknown" });
  });

  it("lets the OS dropdown win over a compound pick", () => {
    expect(resolveDeviceFilter("mobile:ios", "android")).toEqual({ deviceType: "mobile", os: "android" });
  });

  it("keeps the OS dropdown working alone, and ignores junk", () => {
    expect(resolveDeviceFilter(undefined, "ios")).toEqual({ os: "ios" });
    expect(resolveDeviceFilter("any", "unknown")).toEqual({ os: "unknown" });
    expect(resolveDeviceFilter("mobile:windows", undefined)).toEqual({ os: undefined });
    expect(resolveDeviceFilter("bogus", undefined)).toEqual({ os: undefined });
  });
});
