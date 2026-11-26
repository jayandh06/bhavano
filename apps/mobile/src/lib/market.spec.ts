const mockStorage = { getItem: jest.fn(), setItem: jest.fn() };
jest.mock("@react-native-async-storage/async-storage", () => ({ __esModule: true, default: mockStorage }));

type Market = typeof import("./market");
type MarketState = typeof import("./marketState");

function launch(stored: Promise<string | null>): { market: Market; state: MarketState } {
  mockStorage.getItem.mockReset().mockReturnValue(stored);
  mockStorage.setItem.mockReset().mockResolvedValue(undefined);
  let market!: Market;
  let state!: MarketState;
  jest.isolateModules(() => {
    market = require("./market") as Market;
    state = require("./marketState") as MarketState;
  });
  return { market, state };
}

describe("saved market", () => {
  it.each([
    ["us", "us"],
    ["in", "in"],
    ["fr", "in"],
    [null, "in"],
  ])("loads %s as %s", async (stored, expected) => {
    const { market, state } = launch(Promise.resolve(stored));
    await market.hydrateMarket();
    expect(state.getMarketPhase()).toBe("ready");
    expect(market.getCurrentMarketId()).toBe(expected);
  });

  it("opens on India when storage cannot be read", async () => {
    const { market, state } = launch(Promise.reject(new Error("storage")));
    await market.hydrateMarket();
    expect(state.getMarketPhase()).toBe("ready");
    expect(market.getCurrentMarketId()).toBe("in");
  });

  it("reads storage once", async () => {
    const { market } = launch(Promise.resolve(null));
    await Promise.all([market.hydrateMarket(), market.hydrateMarket()]);
    expect(mockStorage.getItem).toHaveBeenCalledTimes(1);
    expect(mockStorage.getItem).toHaveBeenCalledWith("bhavano.market");
  });

  it("saves the market only once the switch has been applied", async () => {
    const { market } = launch(Promise.resolve(null));
    await market.switchMarket("us");
    expect(mockStorage.setItem).not.toHaveBeenCalled();
    market.applyMarketSwitch();
    expect(mockStorage.setItem).toHaveBeenCalledWith("bhavano.market", "us");
    expect(market.getCurrentMarketId()).toBe("us");
  });
});
