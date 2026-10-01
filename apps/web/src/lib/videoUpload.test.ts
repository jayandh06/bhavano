import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { uploadVideoDirect } from "./videoUpload";

/**
 * uploadVideoDirect's retry behaviour: xhr.onerror (a dropped connection, not a status the server
 * returned) gets retried a couple of times with a short delay before giving up, since that's
 * exactly the failure a flaky mobile upload produces and very often clears on its own. A real
 * HTTP error status must never retry — the server already answered, and retrying a 4xx/5xx wastes
 * the same amount of time to get the same rejection.
 */

type FakeXhrEvent = { type: "load"; status: number; responseText: string } | { type: "error" };

/** Each queued script item drives one XHR instance's lifecycle (one per attempt). */
function installFakeXhr(scripts: FakeXhrEvent[]): { sentCount: number } {
  const state = { sentCount: 0 };
  let nextScript = 0;

  class FakeXMLHttpRequest {
    status = 0;
    responseText = "";
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    upload = { onprogress: null as ((e: { lengthComputable: boolean; loaded: number; total: number }) => void) | null };

    open() {}
    setRequestHeader() {}

    send() {
      state.sentCount += 1;
      const script = scripts[nextScript];
      nextScript += 1;
      // setTimeout, not queueMicrotask: this needs to go through the same fake-timer queue as the
      // retry delay (sleep() in videoUpload.ts), so vi.runAllTimersAsync() advances both in a
      // single deterministic order instead of racing a real microtask against faked timers.
      setTimeout(() => {
        if (!script) throw new Error("test bug: ran out of scripted XHR events");
        if (script.type === "error") {
          this.onerror?.();
        } else {
          this.status = script.status;
          this.responseText = script.responseText;
          this.onload?.();
        }
      }, 0);
    }
  }

  vi.stubGlobal("XMLHttpRequest", FakeXMLHttpRequest);
  return state;
}

/** A JWT-shaped (but unsigned, unverified client-side — isAccessTokenValid only checks exp)
 * token with an expiry far in the future. */
function futureToken(): string {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64");
  return `header.${payload}.signature`;
}

const file = new File(["video bytes"], "clip.mp4", { type: "video/mp4" });

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("uploadVideoDirect retry", () => {
  it("retries a dropped connection and resolves once a later attempt succeeds", async () => {
    const xhr = installFakeXhr([
      { type: "error" },
      { type: "error" },
      { type: "load", status: 200, responseText: JSON.stringify({ id: "v1" }) },
    ]);

    const promise = uploadVideoDirect(file, "listing1", futureToken());
    // Attached before advancing timers: the promise settles *during* runAllTimersAsync, and a
    // handler attached only after would leave a window where Node sees it as unhandled.
    const assertion = expect(promise).resolves.toEqual({ id: "v1" });
    await vi.runAllTimersAsync();

    await assertion;
    expect(xhr.sentCount).toBe(3);
  });

  it("gives up after exhausting retries on a connection that never recovers", async () => {
    const xhr = installFakeXhr([{ type: "error" }, { type: "error" }, { type: "error" }]);

    const promise = uploadVideoDirect(file, "listing1", futureToken());
    const assertion = expect(promise).rejects.toThrow("Network error during upload");
    await vi.runAllTimersAsync();

    await assertion;
    // 1 initial attempt + 2 retries = 3 — a 4th would mean the retry limit isn't being respected.
    expect(xhr.sentCount).toBe(3);
  });

  it("never retries a real HTTP error status — the server already answered", async () => {
    const xhr = installFakeXhr([{ type: "load", status: 413, responseText: JSON.stringify({ message: "File too large" }) }]);

    const promise = uploadVideoDirect(file, "listing1", futureToken());
    const assertion = expect(promise).rejects.toThrow("File too large");
    await vi.runAllTimersAsync();

    await assertion;
    expect(xhr.sentCount).toBe(1);
  });
});
