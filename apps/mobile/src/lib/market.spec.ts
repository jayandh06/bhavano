const mockStorage = { getItem: jest.fn(), setItem: jest.fn(), getAllKeys: jest.fn() };
jest.mock("@react-native-async-storage/async-storage", () => ({ __esModule: true, default: mockStorage }));
const mockRegion = jest.fn();
jest.mock("./deviceRegion", () => ({ deviceRegion: () => mockRegion() }));

type Market = typeof import("./market");
type MarketState = typeof import("./marketState");

const offered = process.env.EXPO_PUBLIC_US_ENABLED;
afterAll(() => {
  if (offered === undefined) delete process.env.EXPO_PUBLIC_US_ENABLED;
  else process.env.EXPO_PUBLIC_US_ENABLED = offered;
});

interface Launch {
  stored?: Promise<string | null>;
  keys?: string[];
  region?: string | null;
  usBuild?: boolean;
}

function launch({ stored = Promise.resolve(null), keys = [], region = "IN", usBuild = true }: Launch = {}) {
  if (usBuild) process.env.EXPO_PUBLIC_US_ENABLED = "1";
  else delete process.env.EXPO_PUBLIC_US_ENABLED;
  mockStorage.getItem.mockReset().mockReturnValue(stored);
  mockStorage.setItem.mockReset().mockResolvedValue(undefined);
  mockStorage.getAllKeys.mockReset().mockResolvedValue(keys);
  mockRegion.mockReset().mockReturnValue(region);
  let market!: Market;
  let state!: MarketState;
  jest.isolateModules(() => {
    market = require("./market") as Market;
    state = require("./marketState") as MarketState;
  });
  return { market, state };
}

async function opened(options: Launch) {
  const app = launch(options);
  await app.market.hydrateMarket();
  return [app.state.getMarketPhase(), app.market.getCurrentMarketId()];
}

describe("saved market", () => {
  it.each([
    ["us", "us"],
    ["in", "in"],
    ["fr", "in"],
    [null, "in"],
  ])("loads %s as %s", async (stored, expected) => {
    await expect(opened({ stored: Promise.resolve(stored) })).resolves.toEqual(["ready", expected]);
  });

  it("opens on India when storage cannot be read", async () => {
    await expect(opened({ stored: Promise.reject(new Error("storage")) })).resolves.toEqual(["ready", "in"]);
  });

  it("reads storage once", async () => {
    const { market } = launch();
    await Promise.all([market.hydrateMarket(), market.hydrateMarket()]);
    expect(mockStorage.getItem).toHaveBeenCalledTimes(1);
    expect(mockStorage.getItem).toHaveBeenCalledWith("bhavano.market");
  });

  it("saves the market only once the switch has been applied", async () => {
    const { market } = launch();
    await market.switchMarket("us");
    expect(mockStorage.setItem).not.toHaveBeenCalled();
    market.applyMarketSwitch();
    expect(mockStorage.setItem).toHaveBeenCalledWith("bhavano.market", "us");
    expect(market.getCurrentMarketId()).toBe("us");
  });
});

describe("first launch", () => {
  it("asks a new install whose phone region is the US, and saves the answer", async () => {
    const { market, state } = launch({ region: "US" });
    await market.hydrateMarket();
    expect(state.getMarketPhase()).toBe("choosing");
    expect(mockStorage.setItem).not.toHaveBeenCalled();
    market.chooseFirstMarket("us");
    expect([state.getMarketPhase(), market.getCurrentMarketId()]).toEqual(["ready", "us"]);
    expect(mockStorage.setItem).toHaveBeenCalledWith("bhavano.market", "us");
  });

  it("keeps an update on India without a question, and remembers it", async () => {
    await expect(opened({ region: "US", keys: ["bhavano.viewerKey"] })).resolves.toEqual(["ready", "in"]);
    expect(mockStorage.setItem).toHaveBeenCalledWith("bhavano.market", "in");
  });

  it.each(["IN", "GB", null])("asks nobody whose region is %s", async (region) => {
    await expect(opened({ region })).resolves.toEqual(["ready", "in"]);
    expect(mockStorage.setItem).not.toHaveBeenCalled();
  });

  it("on an India-only build, asks nobody and ignores a saved US choice", async () => {
    await expect(opened({ region: "US", usBuild: false })).resolves.toEqual(["ready", "in"]);
    await expect(opened({ stored: Promise.resolve("us"), usBuild: false })).resolves.toEqual(["ready", "in"]);
    expect(mockStorage.getAllKeys).not.toHaveBeenCalled();
  });
});
