import { describe, expect, it } from "vitest";
import { resolveDeviceFilter } from "./pageVisitDeviceFilter";

describe("resolveDeviceFilter", () => {
  it("passes plain device types through, irrespective of OS", () => {
    expect(resolveDeviceFilter("mobile", undefined)).toMatchObject({ deviceType: "mobile", os: undefined });
    expect(resolveDeviceFilter("mobile_app", "any")).toMatchObject({ deviceType: "mobile_app", os: undefined });
  });

  it("splits a mobile browser and the mobile app by OS", () => {
    expect(resolveDeviceFilter("mobile:ios", undefined)).toMatchObject({ deviceType: "mobile", os: "ios" });
    expect(resolveDeviceFilter("mobile:android", undefined)).toMatchObject({ deviceType: "mobile", os: "android" });
    expect(resolveDeviceFilter("mobile:other", undefined)).toMatchObject({ deviceType: "mobile", os: "unknown" });
    expect(resolveDeviceFilter("mobile_app:ios", undefined)).toMatchObject({ deviceType: "mobile_app", os: "ios" });
    expect(resolveDeviceFilter("mobile_app:android", undefined)).toMatchObject({ deviceType: "mobile_app", os: "android" });
    expect(resolveDeviceFilter("mobile_app:other", undefined)).toMatchObject({ deviceType: "mobile_app", os: "unknown" });
  });

  it("does not let a leftover OS dropdown override the next compound pick (the bug)", () => {
    // Pick "Mobile (iOS)": the page must not fill the OS dropdown with "iOS"...
    const first = resolveDeviceFilter("mobile:ios", undefined);
    expect(first.osDropdown).toBeUndefined();
    // ...so even if a stale "ios" were still submitted, the compound pick wins.
    expect(resolveDeviceFilter("mobile:android", "ios")).toMatchObject({ deviceType: "mobile", os: "android", osDropdown: undefined });
  });

  it("keeps the OS dropdown working with plain device types and alone", () => {
    expect(resolveDeviceFilter("tablet", "ios")).toEqual({ deviceType: "tablet", os: "ios", osDropdown: "ios" });
    expect(resolveDeviceFilter(undefined, "ios")).toEqual({ os: "ios", osDropdown: "ios" });
    expect(resolveDeviceFilter("any", "unknown")).toEqual({ os: "unknown", osDropdown: "unknown" });
  });

  it("ignores junk", () => {
    expect(resolveDeviceFilter("mobile:windows", undefined)).toEqual({ os: undefined, osDropdown: undefined });
    expect(resolveDeviceFilter("bogus", undefined)).toEqual({ os: undefined, osDropdown: undefined });
  });
});
