type MarketState = typeof import("./marketState");

const offered = process.env.EXPO_PUBLIC_US_ENABLED;
beforeEach(() => {
  process.env.EXPO_PUBLIC_US_ENABLED = "1";
});
afterAll(() => {
  if (offered === undefined) delete process.env.EXPO_PUBLIC_US_ENABLED;
  else process.env.EXPO_PUBLIC_US_ENABLED = offered;
});

/** A fresh copy of the module, as at app launch. */
function launch(): MarketState {
  let state!: MarketState;
  jest.isolateModules(() => {
    state = require("./marketState") as MarketState;
  });
  return state;
}

describe("market state", () => {
  it("starts on India, not yet loaded", () => {
    const state = launch();
    expect(state.getCurrentMarketId()).toBe("in");
    expect(state.getMarketPhase()).toBe("loading");
  });

  it("keeps India's stored names unchanged, so an update signs nobody out", () => {
    const state = launch();
    for (const name of ["bhavano.accessToken", "bhavano.city", "bhavano:post-ad-draft", "bhavano.viewerKey"]) {
      expect(state.marketKey(name)).toBe(name);
      expect(state.marketKey(name, "us")).toBe(`${name}.us`);
    }
  });

  it("becomes ready on the saved market, resetting what was held for India", () => {
    const state = launch();
    const reset = jest.fn();
    state.onMarketChange(reset);
    state.finishMarketLoad("us");
    expect(state.getMarketPhase()).toBe("ready");
    expect(state.getCurrentMarketId()).toBe("us");
    expect(state.marketKey("bhavano.city")).toBe("bhavano.city.us");
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("stays on India with nothing saved, and resets nothing", () => {
    const state = launch();
    const reset = jest.fn();
    state.onMarketChange(reset);
    state.finishMarketLoad(null);
    expect(state.getMarketPhase()).toBe("ready");
    expect(state.getCurrentMarketId()).toBe("in");
    expect(reset).not.toHaveBeenCalled();
  });

  it("switches in two steps: goodbyes on the old market, then the change and the resets", async () => {
    const state = launch();
    state.finishMarketLoad(null);
    const seen: string[] = [];
    state.beforeMarketLeave(async () => {
      seen.push(`leave:${state.getCurrentMarketId()}`);
    });
    state.onMarketChange(() => seen.push(`change:${state.getCurrentMarketId()}`));

    await expect(state.requestMarketSwitch("us")).resolves.toBe(true);
    expect(state.getMarketPhase()).toBe("switching");
    expect(state.getCurrentMarketId()).toBe("in");

    expect(state.completeMarketSwitch()).toBe("us");
    expect(state.getMarketPhase()).toBe("ready");
    expect(seen).toEqual(["leave:in", "change:us"]);
  });

  it("does nothing before loading, for the current market, twice at once, or with no switch waiting", async () => {
    const state = launch();
    await expect(state.requestMarketSwitch("us")).resolves.toBe(false);
    state.finishMarketLoad(null);
    await expect(state.requestMarketSwitch("in")).resolves.toBe(false);
    expect(state.completeMarketSwitch()).toBeNull();
    const first = state.requestMarketSwitch("us");
    await expect(state.requestMarketSwitch("us")).resolves.toBe(false);
    await expect(first).resolves.toBe(true);
  });

  it("still switches when a goodbye fails or a reset throws", async () => {
    const state = launch();
    state.finishMarketLoad(null);
    const later = jest.fn();
    state.beforeMarketLeave(() => Promise.reject(new Error("offline")));
    state.onMarketChange(() => {
      throw new Error("broken module");
    });
    state.onMarketChange(later);
    await state.requestMarketSwitch("us");
    expect(state.completeMarketSwitch()).toBe("us");
    expect(later).toHaveBeenCalled();
  });

  it("does not wait for ever on a goodbye that hangs", async () => {
    jest.useFakeTimers();
    try {
      const state = launch();
      state.finishMarketLoad(null);
      state.beforeMarketLeave(() => new Promise<void>(() => undefined));
      const switching = state.requestMarketSwitch("us");
      await jest.advanceTimersByTimeAsync(state.MARKET_LEAVE_TIMEOUT_MS);
      await expect(switching).resolves.toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it("offers the US only on a build made for it, and will not switch there otherwise", async () => {
    delete process.env.EXPO_PUBLIC_US_ENABLED;
    const state = launch();
    expect(state.isMarketOffered("in")).toBe(true);
    expect(state.isMarketOffered("us")).toBe(false);
    expect(state.marketSwitchEnabled()).toBe(false);
    state.finishMarketLoad(null);
    await expect(state.requestMarketSwitch("us")).resolves.toBe(false);
  });

  it("waits for a new install's answer, resetting modules if it is the US", () => {
    const state = launch();
    const reset = jest.fn();
    state.onMarketChange(reset);
    state.askForFirstMarket();
    expect(state.getMarketPhase()).toBe("choosing");
    state.finishMarketLoad(null);
    expect(state.getMarketPhase()).toBe("choosing");
    expect(state.completeFirstChoice("us")).toBe(true);
    expect([state.getMarketPhase(), state.getCurrentMarketId()]).toEqual(["ready", "us"]);
    expect(reset).toHaveBeenCalledTimes(1);
    expect(state.completeFirstChoice("in")).toBe(false);
  });

  it("stops calling a removed hook", async () => {
    const state = launch();
    state.finishMarketLoad(null);
    const hook = jest.fn();
    state.beforeMarketLeave(hook)();
    await state.requestMarketSwitch("us");
    expect(hook).not.toHaveBeenCalled();
  });
});
