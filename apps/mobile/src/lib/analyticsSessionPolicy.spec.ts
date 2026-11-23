import { SESSION_IDLE_MS, isSessionLive, parseStoredSession } from "./analyticsSessionPolicy";

const NOW = 1_800_000_000_000;

describe("isSessionLive", () => {
  it("continues a session reopened inside 30 minutes", () => {
    expect(isSessionLive({ lastActiveAt: NOW - 60_000 }, NOW)).toBe(true);
    expect(isSessionLive({ lastActiveAt: NOW - SESSION_IDLE_MS }, NOW)).toBe(true);
  });

  it("starts a new session after more than 30 minutes", () => {
    expect(isSessionLive({ lastActiveAt: NOW - SESSION_IDLE_MS - 1 }, NOW)).toBe(false);
  });

  it("does not trust a timestamp in the future", () => {
    expect(isSessionLive({ lastActiveAt: NOW + 5_000 }, NOW)).toBe(false);
  });

  it("is not live when nothing is stored", () => {
    expect(isSessionLive(null, NOW)).toBe(false);
    expect(isSessionLive(undefined, NOW)).toBe(false);
  });

  it("covers the 2026-11-23 case: launches 8 minutes, 27 seconds and 3 minutes apart are one session", () => {
    const gaps = [8 * 60_000, 27_000, 3 * 60_000];
    let last = NOW;
    for (const gap of gaps) {
      expect(isSessionLive({ lastActiveAt: last }, last + gap)).toBe(true);
      last += gap;
    }
  });
});

describe("parseStoredSession", () => {
  it("round-trips what is stored", () => {
    const s = { id: "abc", lastActiveAt: NOW, visitSent: true, jsConfirmSent: false };
    expect(parseStoredSession(JSON.stringify(s))).toEqual(s);
  });

  it("treats missing flags as not yet sent", () => {
    expect(parseStoredSession(JSON.stringify({ id: "abc", lastActiveAt: NOW }))).toEqual({
      id: "abc",
      lastActiveAt: NOW,
      visitSent: false,
      jsConfirmSent: false,
    });
  });

  it.each([null, undefined, "", "not json", "null", "{}", JSON.stringify({ id: "", lastActiveAt: 1 }), JSON.stringify({ id: "a", lastActiveAt: "x" })])(
    "returns null for %p",
    (raw) => {
      expect(parseStoredSession(raw as string | null | undefined)).toBeNull();
    },
  );
});
