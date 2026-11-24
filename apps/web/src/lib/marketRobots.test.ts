import { describe, expect, it } from "vitest";
import { siteRobots } from "./marketRobots";

describe("siteRobots", () => {
  it("keeps India indexable, as the layout always had it", () => {
    expect(siteRobots("in")).toEqual({ index: true, follow: true });
  });

  it("treats an unset or unknown market as India, so a missing variable can never noindex bhavano.com", () => {
    expect(siteRobots(undefined)).toEqual({ index: true, follow: true });
    expect(siteRobots("")).toEqual({ index: true, follow: true });
    expect(siteRobots("zz")).toEqual({ index: true, follow: true });
  });

  it("noindexes the US until it is launched", () => {
    expect(siteRobots("us")).toEqual({ index: false, follow: false });
  });
});
