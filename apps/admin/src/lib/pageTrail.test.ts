import { describe, expect, it } from "vitest";
import { trailEntry, trailEntryHref } from "./pageTrail";

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

  it("decodes the login-nudge card's shown/logged-in/dismissed events", () => {
    expect(trailEntry("/login-nudge?event=shown&surface=web_prompt")).toEqual({
      text: "Login nudge shown (card)",
      isError: false,
    });
    expect(trailEntry("/login-nudge?event=login&surface=web_prompt")).toEqual({
      text: "Login nudge — logged in (card)",
      isError: false,
    });
    expect(trailEntry("/login-nudge?event=dismissed&surface=web_prompt")).toEqual({
      text: "Login nudge — dismissed (card)",
      isError: false,
    });
  });

  it("decodes Google One Tap's shown/logged-in/dismissed events", () => {
    expect(trailEntry("/login-nudge?event=shown&surface=one_tap")).toEqual({
      text: "Login nudge shown (One Tap)",
      isError: false,
    });
    expect(trailEntry("/login-nudge?event=login&surface=one_tap")).toEqual({
      text: "Login nudge — logged in (One Tap)",
      isError: false,
    });
    expect(trailEntry("/login-nudge?event=dismissed&surface=one_tap")).toEqual({
      text: "Login nudge — dismissed (One Tap)",
      isError: false,
    });
  });
});

describe("trailEntryHref", () => {
  it("links an ordinary path to the live site", () => {
    expect(trailEntryHref("/post/preview")).toBe("https://www.bhavano.com/post/preview");
    expect(trailEntryHref("/")).toBe("https://www.bhavano.com/");
  });

  it("has no link for a boost-recovery, error, or login-nudge marker — none are real pages", () => {
    expect(trailEntryHref("/post/boost-recovery?event=shown&trigger=idle")).toBeNull();
    expect(trailEntryHref("/post/error?stage=checkout")).toBeNull();
    expect(trailEntryHref("/login-nudge?event=shown&surface=one_tap")).toBeNull();
  });
});
