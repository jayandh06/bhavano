import { withTimeLimit } from "./timeLimit";

describe("a request with a time limit", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("gives the answer that arrives in time, and leaves no timer behind", async () => {
    await expect(withTimeLimit(Promise.resolve("cities"), 1000)).resolves.toBe("cities");
    expect(jest.getTimerCount()).toBe(0);
  });

  it("passes the request's own failure on", async () => {
    await expect(withTimeLimit(Promise.reject(new Error("offline")), 1000)).rejects.toThrow("offline");
    expect(jest.getTimerCount()).toBe(0);
  });

  it("fails a request that never answers", async () => {
    const waiting = expect(withTimeLimit(new Promise(() => undefined), 1000)).rejects.toThrow("took too long");
    await jest.advanceTimersByTimeAsync(1000);
    await waiting;
  });
});
