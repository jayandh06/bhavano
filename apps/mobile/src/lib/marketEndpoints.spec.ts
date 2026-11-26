const NAMES = ["EXPO_PUBLIC_BFF_URL", "EXPO_PUBLIC_SITE_URL", "EXPO_PUBLIC_US_BFF_URL", "EXPO_PUBLIC_US_SITE_URL"] as const;
const saved = Object.fromEntries(NAMES.map((name) => [name, process.env[name]]));

type Endpoints = typeof import("./marketEndpoints");

function on(market: "in" | "us", env: Partial<Record<(typeof NAMES)[number], string>> = {}): Endpoints {
  for (const name of NAMES) {
    if (env[name] === undefined) delete process.env[name];
    else process.env[name] = env[name];
  }
  let endpoints!: Endpoints;
  jest.isolateModules(() => {
    (require("./marketState") as typeof import("./marketState")).finishMarketLoad(market);
    endpoints = require("./marketEndpoints") as Endpoints;
  });
  return endpoints;
}

afterAll(() => {
  for (const name of NAMES) {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  }
});

describe("market addresses", () => {
  it("India: the addresses the app has always used", () => {
    expect(on("in").apiUrl()).toBe("http://localhost:4000");
    expect(on("in").siteUrl()).toBe("https://bhavano.com");
    const set = on("in", { EXPO_PUBLIC_BFF_URL: "https://api.bhavano.com", EXPO_PUBLIC_SITE_URL: "https://www.bhavano.com" });
    expect(set.apiUrl()).toBe("https://api.bhavano.com");
    expect(set.siteUrl()).toBe("https://www.bhavano.com");
  });

  it("US: its own server and /us, never India's settings", () => {
    const us = on("us", { EXPO_PUBLIC_BFF_URL: "https://api.bhavano.com", EXPO_PUBLIC_SITE_URL: "https://bhavano.com" });
    expect(us.apiUrl()).toBe("https://api.us.bhavano.com");
    expect(us.siteUrl()).toBe("https://www.bhavano.com/us");
  });

  it("US: can be pointed elsewhere, and an empty setting means the default", () => {
    const local = on("us", { EXPO_PUBLIC_US_BFF_URL: "http://10.0.0.5:4100", EXPO_PUBLIC_US_SITE_URL: "http://10.0.0.5:3100/us" });
    expect(local.apiUrl()).toBe("http://10.0.0.5:4100");
    expect(local.siteUrl()).toBe("http://10.0.0.5:3100/us");
    const empty = on("us", { EXPO_PUBLIC_US_BFF_URL: "", EXPO_PUBLIC_US_SITE_URL: "" });
    expect(empty.apiUrl()).toBe("https://api.us.bhavano.com");
    expect(empty.siteUrl()).toBe("https://www.bhavano.com/us");
  });
});
