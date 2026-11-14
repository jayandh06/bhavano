import { describe, expect, it } from "vitest";
import { rolloutBucket } from "@bhavano/types/loginNudge";
import { parsePostFormVariant, parseRolloutPercent, resolvePostFormVariant } from "./postFormVariant";

describe("parseRolloutPercent", () => {
  it("reads whole numbers from 0 to 100", () => {
    expect(parseRolloutPercent("0")).toBe(0);
    expect(parseRolloutPercent("25")).toBe(25);
    expect(parseRolloutPercent(" 50 ")).toBe(50);
    expect(parseRolloutPercent("100")).toBe(100);
  });

  it("caps anything above 100", () => {
    expect(parseRolloutPercent("250")).toBe(100);
  });

  it("treats missing or malformed values as nobody, so a typo cannot switch the new form on for everyone", () => {
    for (const bad of [undefined, "", "abc", "-5", "12.5", "50%", "1000"]) {
      expect(parseRolloutPercent(bad), String(bad)).toBe(0);
    }
  });
});

describe("parsePostFormVariant", () => {
  it("accepts only v1 and v2", () => {
    expect(parsePostFormVariant("v1")).toBe("v1");
    expect(parsePostFormVariant("v2")).toBe("v2");
    for (const bad of [undefined, null, "", "V2", "new", ["v2"], 2]) expect(parsePostFormVariant(bad)).toBeNull();
  });
});

describe("resolvePostFormVariant", () => {
  it("lets an explicit override win over the rollout", () => {
    expect(resolvePostFormVariant({ override: "v2", percent: 0, viewerKey: "x" })).toBe("v2");
    expect(resolvePostFormVariant({ override: "v1", percent: 100, viewerKey: "x" })).toBe("v1");
  });

  it("shows v1 to everyone at 0% and v2 to everyone at 100%", () => {
    expect(resolvePostFormVariant({ override: null, percent: 0, viewerKey: "abc" })).toBe("v1");
    expect(resolvePostFormVariant({ override: null, percent: 100, viewerKey: "abc" })).toBe("v2");
    expect(resolvePostFormVariant({ override: null, percent: 100, viewerKey: "" })).toBe("v2");
  });

  it("keeps a visitor in the same group every time, decided by their bucket", () => {
    const key = "visitor-42";
    const bucket = rolloutBucket(key);
    expect(resolvePostFormVariant({ override: null, percent: bucket, viewerKey: key })).toBe("v1");
    expect(resolvePostFormVariant({ override: null, percent: bucket + 1, viewerKey: key })).toBe("v2");
    const again = resolvePostFormVariant({ override: null, percent: 30, viewerKey: key });
    expect(resolvePostFormVariant({ override: null, percent: 30, viewerKey: key })).toBe(again);
  });

  it("gives a visitor with no viewer key the known form below 100%", () => {
    expect(resolvePostFormVariant({ override: null, percent: 50, viewerKey: "" })).toBe("v1");
  });

  it("splits a population roughly in proportion to the percentage", () => {
    let v2 = 0;
    for (let i = 0; i < 2000; i++) {
      if (resolvePostFormVariant({ override: null, percent: 50, viewerKey: `visitor-${i}-${i * 7919}` }) === "v2") v2++;
    }
    expect(v2).toBeGreaterThan(800);
    expect(v2).toBeLessThan(1200);
  });
});
