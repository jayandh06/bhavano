import { describe, expect, it } from "vitest";
import { trailEntry } from "./pageTrail";

describe("trailEntry", () => {
  it("leaves ordinary paths untouched", () => {
    expect(trailEntry("/post/preview")).toEqual({ text: "/post/preview", isError: false });
    expect(trailEntry("/")).toEqual({ text: "/", isError: false });
  });

  it("decodes a wizard error into a readable, flagged entry", () => {
    const path = `/post/error?stage=publish&reason=${encodeURIComponent("Failed to upload a photo — too large")}`;
    expect(trailEntry(path)).toEqual({
      text: "Error on publish — Failed to upload a photo — too large",
      isError: true,
    });
  });

  it("still flags an error path with no reason", () => {
    expect(trailEntry("/post/error?stage=checkout")).toEqual({ text: "Error on checkout", isError: true });
  });

  it("decodes a boost recovery dialog shown via the idle timer", () => {
    expect(trailEntry("/post/boost-recovery?event=shown&trigger=idle")).toEqual({
      text: "Boost recovery shown (60s idle)",
      isError: false,
    });
  });

  it("decodes a boost recovery dialog shown via the submit intercept", () => {
    expect(trailEntry("/post/boost-recovery?event=shown&trigger=submit")).toEqual({
      text: "Boost recovery shown (tapped Post ad)",
      isError: false,
    });
  });

  it("decodes accepting and dismissing the boost recovery dialog, neither as an error", () => {
    expect(trailEntry("/post/boost-recovery?event=accepted")).toEqual({
      text: "Boost recovery — added Boost",
      isError: false,
    });
    expect(trailEntry("/post/boost-recovery?event=dismissed")).toEqual({
      text: "Boost recovery — skipped",
      isError: false,
    });
  });
});
