import { afterEach, describe, expect, it, vi } from "vitest";

// Both helpers read a NEXT_PUBLIC_* value that Next fixes at build time, so each case sets it and loads a fresh copy of the module.
async function load<T>(path: string, env: Record<string, string | undefined>): Promise<T> {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) vi.stubEnv(k, "");
    else vi.stubEnv(k, v);
  }
  return (await import(path)) as T;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("cookieName", () => {
  it("keeps India's cookie names as they are", async () => {
    const { cookieName } = await load<typeof import("./cookieNames")>("./cookieNames", { NEXT_PUBLIC_MARKET: undefined });
    expect(cookieName("bhavano_sid")).toBe("bhavano_sid");
    expect(cookieName("bhavano_city")).toBe("bhavano_city");
  });

  it("gives the US build its own names, so the shared host never mixes the two", async () => {
    const { cookieName } = await load<typeof import("./cookieNames")>("./cookieNames", { NEXT_PUBLIC_MARKET: "us" });
    expect(cookieName("bhavano_sid")).toBe("bhavano_sid_us");
    expect(cookieName("bhavano_acq")).toBe("bhavano_acq_us");
  });
});

describe("withBasePath", () => {
  it("leaves India's paths alone", async () => {
    const { withBasePath } = await load<typeof import("./basePath")>("./basePath", { NEXT_PUBLIC_BASE_PATH: undefined });
    expect(withBasePath("/api/analytics/pageview")).toBe("/api/analytics/pageview");
  });

  it("puts the US build's paths under /us", async () => {
    const { withBasePath } = await load<typeof import("./basePath")>("./basePath", { NEXT_PUBLIC_BASE_PATH: "/us" });
    expect(withBasePath("/api/analytics/pageview")).toBe("/us/api/analytics/pageview");
  });
});
