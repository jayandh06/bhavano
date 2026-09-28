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
});
