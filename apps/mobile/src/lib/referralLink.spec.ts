jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  multiSet: jest.fn(),
}));

import { listingIdFromPath } from "./referralLink";

describe("listingIdFromPath", () => {
  it("reads the cuid off a canonical listing path", () => {
    expect(
      listingIdFromPath("/bengaluru/hsr-layout/rent-lease/apartment/2bhk-near-park-cmu72rr5f001401lg1ai2hiuz"),
    ).toBe("cmu72rr5f001401lg1ai2hiuz");
  });

  it("reads a legacy uuid id", () => {
    expect(listingIdFromPath("/pune/buy/house/villa-3f2504e0-4f89-11d3-9a0c-0305e82c3301")).toBe(
      "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
    );
  });

  it.each(["/bengaluru/hsr-layout", "/bengaluru/rent-lease", "my-listings", "messages/new/abc", "listing/cmu72rr5f001401lg1ai2hiuz", ""])(
    "ignores non-listing path %p",
    (path) => {
      expect(listingIdFromPath(path)).toBeUndefined();
    },
  );
});
