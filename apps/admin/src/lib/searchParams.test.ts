import { describe, expect, it } from "vitest";
import { buildPageHref, buildSortHref, buildSuffixSortHref, carriedValue, isDateRangeKey } from "./searchParams";

describe("isDateRangeKey", () => {
  it("recognises the date-range params the admin screens use", () => {
    for (const key of ["from", "to", "createdFrom", "createdTo", "updatedFrom", "updatedTo"]) {
      expect(isDateRangeKey(key)).toBe(true);
    }
    for (const key of ["search", "userId", "tab", "page", "limit", "sort"]) {
      expect(isDateRangeKey(key)).toBe(false);
    }
  });
});

describe("carriedValue", () => {
  it("keeps a value, keeps a deliberately emptied date range, and drops any other empty param", () => {
    expect(carriedValue("tab", "all")).toBe("all");
    expect(carriedValue("createdFrom", "")).toBe("");
    expect(carriedValue("to", "")).toBe("");
    expect(carriedValue("search", "")).toBeUndefined();
    expect(carriedValue("userId", undefined)).toBeUndefined();
    expect(carriedValue("tab", ["a", "b"])).toBeUndefined();
  });
});

describe("links keep an emptied date range", () => {
  // Admin cleared the dates and applied: "no date limit". The next-page link must not turn that back into the
  // screen's silent default window (which made page 2 differ from page 1 until Apply was pressed again).
  const sp = { createdFrom: "", createdTo: "", tab: "all", search: "", userId: "" };

  it("pagination", () => {
    expect(buildPageHref("/", sp, 2)).toBe("/?createdFrom=&createdTo=&tab=all&page=2");
  });

  it("sorting", () => {
    expect(buildSortHref("/", sp, "createdAt")).toBe("/?createdFrom=&createdTo=&tab=all&sort=createdAt");
    expect(buildSuffixSortHref("/", sp, "createdAt")).toBe("/?createdFrom=&createdTo=&tab=all&sort=createdAt_asc");
  });

  it("page 1 still drops page, and a screen with no filters stays a bare path", () => {
    expect(buildPageHref("/", sp, 1)).toBe("/?createdFrom=&createdTo=&tab=all");
    expect(buildPageHref("/", { search: "" }, 1)).toBe("/");
  });
});
