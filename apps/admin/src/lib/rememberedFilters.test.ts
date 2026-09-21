import { describe, expect, it } from "vitest";
import {
  decideFilterAction,
  isExcludedPath,
  parseSavedFilters,
  persistableQuery,
  stripFrameworkParams,
} from "./rememberedFilters";

describe("isExcludedPath", () => {
  it("excludes NextAuth's own routes, not admin screens", () => {
    expect(isExcludedPath("/login")).toBe(true);
    expect(isExcludedPath("/auth/complete")).toBe(true);
    expect(isExcludedPath("/listings")).toBe(false);
    expect(isExcludedPath("/")).toBe(false);
  });
});

describe("parseSavedFilters", () => {
  it("reads back a stored map", () => {
    expect(parseSavedFilters('{"/listings":"status=active"}')).toEqual({ "/listings": "status=active" });
  });

  it("treats missing, malformed, or non-object cookies as nothing remembered", () => {
    expect(parseSavedFilters(null)).toEqual({});
    expect(parseSavedFilters(undefined)).toEqual({});
    expect(parseSavedFilters("")).toEqual({});
    expect(parseSavedFilters("not json")).toEqual({});
    expect(parseSavedFilters("[1,2,3]")).toEqual({});
    expect(parseSavedFilters('"just a string"')).toEqual({});
  });
});

describe("persistableQuery", () => {
  it("keeps filters and view state, drops page", () => {
    expect(persistableQuery("status=active&cols=id,name&page=7")).toBe("status=active&cols=id%2Cname");
  });

  it("collapses to empty for a page-only or bare query", () => {
    expect(persistableQuery("")).toBe("");
    expect(persistableQuery("page=3")).toBe("");
  });
});

describe("stripFrameworkParams", () => {
  it("removes Next's _rsc cache-token", () => {
    expect(stripFrameworkParams("_rsc=7uylb0PiNewL3a1J")).toBe("");
    expect(stripFrameworkParams("status=active&_rsc=7uylb0PiNewL3a1J")).toBe("status=active");
  });

  it("leaves a real query untouched when there's no _rsc", () => {
    expect(stripFrameworkParams("status=active&cols=id,name")).toBe("status=active&cols=id%2Cname");
    expect(stripFrameworkParams("")).toBe("");
  });

  /**
   * The actual production bug, reproduced end to end: a real filter is applied (a full-page form
   * submit, no _rsc), then the visitor clicks a plain nav link back to the same bare screen — a
   * client-side <Link> navigation, which Next tags with its own _rsc token regardless of whether
   * it's a genuine click or a background prefetch. Without stripFrameworkParams, that arrives at
   * decideFilterAction as a non-empty "real" query and silently overwrites the remembered filter
   * with nothing but the token. A curl-based reproduction of this exact sequence never catches it
   * (curl never sends _rsc), which is why the middleware-level fix (prefetch={false}, verified
   * directly against the dev server) shipped first and this one — the actual root cause — didn't
   * surface until a real browser's HAR was inspected.
   */
  it("without stripping _rsc, a nav-link revisit would silently erase the remembered filter", () => {
    const afterApplyingAFilter = { "/page-visits": "traffic=js_confirmed&city=Mumbai" };

    const rawRevisitQuery = "_rsc=jLHZ-Scs7iFp0fWn"; // exactly what Next's router actually sends
    const buggyAction = decideFilterAction({
      pathname: "/page-visits",
      currentQuery: rawRevisitQuery, // unstripped
      refererPathname: "/users",
      saved: afterApplyingAFilter,
    });
    expect(buggyAction).toEqual({
      type: "write",
      saved: { "/page-visits": "_rsc=jLHZ-Scs7iFp0fWn" }, // the filter is gone
    });

    const fixedAction = decideFilterAction({
      pathname: "/page-visits",
      currentQuery: stripFrameworkParams(rawRevisitQuery), // what middleware.ts actually passes
      refererPathname: "/users",
      saved: afterApplyingAFilter,
    });
    expect(fixedAction).toEqual({ type: "restore", query: "traffic=js_confirmed&city=Mumbai" });
  });
});

describe("decideFilterAction", () => {
  it("remembers a real query, regardless of referer", () => {
    expect(
      decideFilterAction({
        pathname: "/listings",
        currentQuery: "status=active",
        refererPathname: null,
        saved: {},
      }),
    ).toEqual({ type: "write", saved: { "/listings": "status=active" } });
  });

  it("does nothing when the incoming query already matches what's remembered", () => {
    expect(
      decideFilterAction({
        pathname: "/listings",
        currentQuery: "status=active",
        refererPathname: null,
        saved: { "/listings": "status=active" },
      }),
    ).toEqual({ type: "noop" });
  });

  it("restores on a fresh arrival at a screen with something remembered", () => {
    expect(
      decideFilterAction({
        pathname: "/listings",
        currentQuery: "",
        refererPathname: "/users", // came from a different screen
        saved: { "/listings": "status=active" },
      }),
    ).toEqual({ type: "restore", query: "status=active" });
  });

  it("does nothing on a bare arrival with nothing remembered for it", () => {
    expect(
      decideFilterAction({ pathname: "/listings", currentQuery: "", refererPathname: null, saved: {} }),
    ).toEqual({ type: "noop" });
  });

  it("treats a bare navigation with no referer as a fresh arrival, not a same-screen reset", () => {
    // A typed URL, a bookmark, or a brand new tab all arrive with no Referer at all — must not be
    // mistaken for "the visitor was already here and clicked reset".
    expect(
      decideFilterAction({
        pathname: "/listings",
        currentQuery: "",
        refererPathname: null,
        saved: { "/listings": "status=active" },
      }),
    ).toEqual({ type: "restore", query: "status=active" });
  });

  /**
   * The case a stateless, request-scoped decision can't get from `currentQuery` alone: a bare
   * URL is ambiguous between "fresh arrival, please restore" and "I was already here and just
   * cleared my filters, please don't put them right back". Referer is what tells them apart — the
   * visitor navigating to this exact same pathname's bare form, from this exact same pathname,
   * only happens via an in-page "clear filters" action.
   */
  it("treats a bare navigation FROM the same screen as a deliberate reset, not a restore", () => {
    const action = decideFilterAction({
      pathname: "/listings",
      currentQuery: "",
      refererPathname: "/listings",
      saved: { "/listings": "status=active" },
    });
    expect(action).toEqual({ type: "write", saved: { "/listings": "" } });
  });

  it("does not keep re-writing an already-cleared reset", () => {
    expect(
      decideFilterAction({
        pathname: "/listings",
        currentQuery: "",
        refererPathname: "/listings",
        saved: { "/listings": "" },
      }),
    ).toEqual({ type: "noop" });
  });

  it("an empty remembered value never gets restored — the reset stays stuck", () => {
    expect(
      decideFilterAction({
        pathname: "/listings",
        currentQuery: "",
        refererPathname: "/users",
        saved: { "/listings": "" },
      }),
    ).toEqual({ type: "noop" });
  });

  it("keeps each path's filters independent", () => {
    const saved = { "/listings": "status=active" };
    expect(
      decideFilterAction({ pathname: "/users", currentQuery: "role=admin", refererPathname: null, saved }),
    ).toEqual({ type: "write", saved: { "/listings": "status=active", "/users": "role=admin" } });
  });

  it("evicts the least-recently-touched path once over the cap", () => {
    const saved: Record<string, string> = {};
    for (let i = 0; i < 40; i++) saved[`/path-${i}`] = "q=1";

    const action = decideFilterAction({
      pathname: "/path-40",
      currentQuery: "q=1",
      refererPathname: null,
      saved,
    });

    expect(action.type).toBe("write");
    if (action.type !== "write") throw new Error("unreachable");
    expect(Object.keys(action.saved)).toHaveLength(40);
    expect(action.saved["/path-0"]).toBeUndefined(); // oldest, evicted
    expect(action.saved["/path-40"]).toBe("q=1"); // newest, present
  });
});
