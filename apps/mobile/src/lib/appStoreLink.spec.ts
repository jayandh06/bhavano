const mockUsPhone = jest.fn();
jest.mock("./deviceRegion", () => ({ isUsPhone: () => mockUsPhone() }));

import { iosStoreUrl } from "./appUpdate";

const offered = process.env.EXPO_PUBLIC_US_ENABLED;
afterAll(() => {
  if (offered === undefined) delete process.env.EXPO_PUBLIC_US_ENABLED;
  else process.env.EXPO_PUBLIC_US_ENABLED = offered;
});

function link(usBuild: boolean, usPhone: boolean): string {
  if (usBuild) process.env.EXPO_PUBLIC_US_ENABLED = "1";
  else delete process.env.EXPO_PUBLIC_US_ENABLED;
  mockUsPhone.mockReturnValue(usPhone);
  return iosStoreUrl();
}

describe("the iPhone Update button", () => {
  it("opens India's App Store, except on a US phone with a build that offers the US", () => {
    const india = "https://apps.apple.com/in/app/bhavano/id6811878602";
    expect(link(false, false)).toBe(india);
    expect(link(false, true)).toBe(india);
    expect(link(true, false)).toBe(india);
    expect(link(true, true)).toBe("https://apps.apple.com/us/app/bhavano/id6811878602");
  });
});
