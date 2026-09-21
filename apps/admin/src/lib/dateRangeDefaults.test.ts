import { describe, expect, it, vi } from "vitest";
import { daysAgoIST, istDayEnd, istDayStart, todayIST } from "./dateRangeDefaults";

describe("istDayStart / istDayEnd", () => {
  it("widens a bare date to the IST day's first/last instant", () => {
    expect(istDayStart("2026-03-15")).toBe("2026-03-15T00:00:00.000+05:30");
    expect(istDayEnd("2026-03-15")).toBe("2026-03-15T23:59:59.999+05:30");
  });

  it("passes through undefined unchanged", () => {
    expect(istDayStart(undefined)).toBeUndefined();
    expect(istDayEnd(undefined)).toBeUndefined();
  });
});

describe("todayIST / daysAgoIST", () => {
  it("daysAgoIST(1) is today itself — a 1-day window", () => {
    expect(daysAgoIST(1)).toBe(todayIST());
  });

  it("computes a fixed instant's IST calendar day correctly across the UTC offset boundary", () => {
    // 2026-03-15T20:00:00Z is 2026-03-16T01:30 IST (+05:30) — a date that would read as the
    // *previous* day if this math were done in UTC instead of IST.
    vi.setSystemTime(new Date("2026-03-15T20:00:00.000Z"));
    expect(todayIST()).toBe("2026-03-16");
    vi.useRealTimers();
  });

  it("daysAgoIST(7) is 6 calendar days before today, IST", () => {
    vi.setSystemTime(new Date("2026-03-16T10:00:00.000Z")); // 2026-03-16T15:30 IST
    expect(todayIST()).toBe("2026-03-16");
    expect(daysAgoIST(7)).toBe("2026-03-10");
    vi.useRealTimers();
  });
});
