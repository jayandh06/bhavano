import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { restoreBasePath } from "./authRequest";

const req = (path: string, init?: ConstructorParameters<typeof NextRequest>[1]) => new NextRequest(`https://us-origin.bhavano.com${path}`, init);

describe("restoreBasePath", () => {
  it("leaves India's requests untouched (no base path)", () => {
    const r = req("/api/auth/csrf");
    expect(restoreBasePath(r, "")).toBe(r);
  });

  it("puts /us back on the path Next stripped, keeping the query", () => {
    const out = restoreBasePath(req("/api/auth/callback/google?code=abc&state=xyz"), "/us");
    expect(new URL(out.url).pathname).toBe("/us/api/auth/callback/google");
    expect(new URL(out.url).search).toBe("?code=abc&state=xyz");
  });

  it("does not add the prefix twice", () => {
    const r = req("/us/api/auth/session");
    expect(restoreBasePath(r, "/us")).toBe(r);
  });

  it("keeps the method, headers and body of a POST", async () => {
    const out = restoreBasePath(req("/api/auth/signin/credentials", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", cookie: "a=b" }, body: "x=1" }), "/us");
    expect(out.method).toBe("POST");
    expect(out.headers.get("cookie")).toBe("a=b");
    expect(await out.text()).toBe("x=1");
  });
});
