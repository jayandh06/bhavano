import { describe, expect, it } from "vitest";
import { isSameLocalDay } from "./useAppLinkEnv";

describe("isSameLocalDay", () => {
  it("is true for two times on the same local date", () => {
    expect(isSameLocalDay(new Date(2026, 9, 5, 0, 1).getTime(), new Date(2026, 9, 5, 23, 59).getTime())).toBe(true);
  });

  it("is false across local midnight, even minutes apart", () => {
    expect(isSameLocalDay(new Date(2026, 9, 5, 23, 55).getTime(), new Date(2026, 9, 6, 0, 5).getTime())).toBe(false);
  });

  it("is false for the same time of day on another date", () => {
    expect(isSameLocalDay(new Date(2026, 9, 5, 10).getTime(), new Date(2026, 10, 5, 10).getTime())).toBe(false);
  });
});
