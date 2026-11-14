import { describe, expect, it } from "vitest";
import { rolloutBucket } from "@bhavano/types/loginNudge";
import { normalizeRolloutPercent, parsePostFormVariant, postFormTrackLabel, resolvePostFormVariant } from "./postFormVariant";

describe("normalizeRolloutPercent", () => {
  it("keeps whole numbers from 0 to 100", () => {
    for (const n of [0, 1, 25, 50, 100]) expect(normalizeRolloutPercent(n)).toBe(n);
  });

  it("caps and floors out-of-range numbers", () => {
    expect(normalizeRolloutPercent(250)).toBe(100);
    expect(normalizeRolloutPercent(-5)).toBe(0);
  });

  it("treats anything that is not a whole number as nobody, so a bad value cannot switch the new form on for everyone", () => {
    for (const bad of [undefined, null, "", "50", NaN, 12.5, Infinity, {}, [50]]) expect(normalizeRolloutPercent(bad)).toBe(0);
  });
});

describe("parsePostFormVariant", () => {
  it("accepts only v1, v2 and v3", () => {
    expect(parsePostFormVariant("v1")).toBe("v1");
    expect(parsePostFormVariant("v2")).toBe("v2");
    expect(parsePostFormVariant("v3")).toBe("v3");
    for (const bad of [undefined, null, "", "V2", "v4", "new", ["v2"], 2]) expect(parsePostFormVariant(bad)).toBeNull();
  });
});

describe("resolvePostFormVariant", () => {
  it("always gives an admin the newest form, v3, whatever the percentage or an override", () => {
    expect(resolvePostFormVariant({ isAdmin: true, override: null, percent: 0, viewerKey: "x" })).toBe("v3");
    expect(resolvePostFormVariant({ isAdmin: true, override: "v1", percent: 0, viewerKey: "x" })).toBe("v3");
    expect(resolvePostFormVariant({ isAdmin: true, override: "v2", percent: 100, viewerKey: "" })).toBe("v3");
  });

  it("never assigns v3 through the rollout percentage: only an admin or ?form=v3 gets it", () => {
    for (const percent of [0, 1, 50, 99, 100]) {
      for (let i = 0; i < 200; i++) {
        expect(resolvePostFormVariant({ override: null, percent, viewerKey: `visitor-${i}` }), `${percent}% visitor ${i}`).not.toBe("v3");
      }
    }
    expect(resolvePostFormVariant({ override: "v3", percent: 0, viewerKey: "x" })).toBe("v3");
  });

  it("lets an explicit override win over the rollout for everyone else", () => {
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

describe("postFormTrackLabel", () => {
  it("labels admin sessions `admin` so they never count towards the v1 / v2 comparison", () => {
    expect(postFormTrackLabel("v3", true)).toBe("admin");
    expect(postFormTrackLabel("v3", false)).toBe("v3");
    expect(postFormTrackLabel("v2", false)).toBe("v2");
    expect(postFormTrackLabel("v1", false)).toBe("v1");
  });
});
