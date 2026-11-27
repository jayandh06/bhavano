const mockLocales = jest.fn();
const mockCalendars = jest.fn();
jest.mock("expo-localization", () => ({ getLocales: () => mockLocales(), getCalendars: () => mockCalendars() }), { virtual: true });

import { isUsPhone } from "./deviceRegion";

function phone(regionCode: string | null, timeZone: string | null) {
  mockLocales.mockReturnValue([{ regionCode }]);
  mockCalendars.mockReturnValue([{ timeZone }]);
  return isUsPhone();
}

describe("a phone set up for the US", () => {
  it.each(["America/New_York", "America/Chicago", "America/Denver", "America/Phoenix", "America/Los_Angeles", "America/Anchorage", "Pacific/Honolulu", "US/Pacific"])(
    "US region in %s",
    (zone) => expect(phone("US", zone)).toBe(true),
  );

  it.each([
    ["US", "Asia/Kolkata"], // India, with the phone in "English (United States)"
    ["US", "Asia/Calcutta"],
    ["US", "Asia/Dubai"],
    ["US", "America/Toronto"],
    ["US", "America/Mexico_City"],
    ["US", "America/Sao_Paulo"],
    ["US", null],
    ["IN", "America/New_York"],
    [null, "America/New_York"],
  ])("is not: region %s, time zone %s", (region, zone) => {
    expect(phone(region, zone)).toBe(false);
  });

  it("is not when the phone cannot say", () => {
    mockLocales.mockImplementation(() => {
      throw new Error("Cannot find native module 'ExpoLocalization'");
    });
    expect(isUsPhone()).toBe(false);
  });
});
