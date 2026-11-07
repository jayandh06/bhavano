import { describe, expect, it } from "vitest";
import { showDiwali } from "./festive";

describe("showDiwali", () => {
  it("is on from the morning of 5 Nov 2026 India time until the end of 11 Nov", () => {
    expect(showDiwali(new Date("2026-11-04T18:29:00Z"))).toBe(false); // 4 Nov 23:59 IST
    expect(showDiwali(new Date("2026-11-04T18:30:00Z"))).toBe(true); // 5 Nov 00:00 IST
    expect(showDiwali(new Date("2026-11-08T10:00:00Z"))).toBe(true); // Diwali day
    expect(showDiwali(new Date("2026-11-11T18:29:00Z"))).toBe(true); // 11 Nov 23:59 IST
    expect(showDiwali(new Date("2026-11-11T18:30:00Z"))).toBe(false); // 12 Nov 00:00 IST
  });

  it("can be forced on or off from the URL for previewing", () => {
    expect(showDiwali(new Date("2027-03-01T00:00:00Z"), "diwali")).toBe(true);
    expect(showDiwali(new Date("2026-11-08T10:00:00Z"), "off")).toBe(false);
    expect(showDiwali(new Date("2027-03-01T00:00:00Z"), "other")).toBe(false);
  });
});
