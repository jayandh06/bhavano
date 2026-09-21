import { describe, expect, it } from "vitest";
import {
  CLEAR_FILTERS_PARAM,
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
   * The first production bug, reproduced end to end: a real filter is applied (a full-page form
   * submit, no _rsc), then the visitor clicks a plain nav link back to the same bare screen — a
   * client-side <Link> navigation, which Next tags with its own _rsc token regardless of whether
   * it's a genuine click or a background prefetch. Without stripFrameworkParams, that arrives at
   * decideFilterAction as a non-empty "real" query and silently overwrites the remembered filter
   * with nothing but the token. A curl-based reproduction of this exact sequence never catches it
   * (curl never sends _rsc), which is why this didn't surface until a real browser's HAR was
   * inspected.
   */
  it("without stripping _rsc, a nav-link revisit would silently erase the remembered filter", () => {
    const afterApplyingAFilter = { "/page-visits": "traffic=js_confirmed&city=Mumbai" };

    const rawRevisitQuery = "_rsc=jLHZ-Scs7iFp0fWn"; // exactly what Next's router actually sends
    const buggyAction = decideFilterAction({
      pathname: "/page-visits",
      currentQuery: rawRevisitQuery, // unstripped
      saved: afterApplyingAFilter,
    });
    expect(buggyAction).toEqual({
      type: "write",
      saved: { "/page-visits": "_rsc=jLHZ-Scs7iFp0fWn" }, // the filter is gone
    });

    const fixedAction = decideFilterAction({
      pathname: "/page-visits",
      currentQuery: stripFrameworkParams(rawRevisitQuery), // what middleware.ts actually passes
      saved: afterApplyingAFilter,
    });
    expect(fixedAction).toEqual({ type: "restore", query: "traffic=js_confirmed&city=Mumbai" });
  });
});

describe("decideFilterAction", () => {
  it("remembers a real query", () => {
    expect(
      decideFilterAction({ pathname: "/listings", currentQuery: "status=active", saved: {} }),
    ).toEqual({ type: "write", saved: { "/listings": "status=active" } });
  });

  it("does nothing when the incoming query already matches what's remembered", () => {
    expect(
      decideFilterAction({
        pathname: "/listings",
        currentQuery: "status=active",
        saved: { "/listings": "status=active" },
      }),
    ).toEqual({ type: "noop" });
  });

  it("restores on a fresh arrival at a screen with something remembered", () => {
    expect(
      decideFilterAction({ pathname: "/listings", currentQuery: "", saved: { "/listings": "status=active" } }),
    ).toEqual({ type: "restore", query: "status=active" });
  });

  it("does nothing on a bare arrival with nothing remembered for it", () => {
    expect(decideFilterAction({ pathname: "/listings", currentQuery: "", saved: {} })).toEqual({
      type: "noop",
    });
  });

  /**
   * The second production bug (the one this test suite didn't originally cover): a bare "clear
   * filters" link is structurally identical to the admin nav's own link for whichever screen is
   * currently on screen — both are a bare href pointing at the current pathname. An earlier
   * version tried to tell them apart using the Referer header (same-pathname Referer = reset), but
   * that broke on the ordinary, harmless act of clicking the nav's "you are here" tab while
   * already on that screen — which produces the exact same signal and isn't a reset at all. That's
   * why the bug looked like "works a few times, then stops": it took exactly one such click to
   * wipe the remembered filter, not a failure on every navigation. CLEAR_FILTERS_PARAM replaces
   * that inference with an explicit signal instead.
   */
  it("clears the remembered filter only when the explicit reset marker is present", () => {
    const saved = { "/page-visits": "traffic=js_confirmed&city=Mumbai" };

    // A bare arrival — whether from the nav's "you are here" tab, a fresh tab, or navigating in
    // from elsewhere — always restores. There is no "this looks like a reset" case anymore.
    expect(decideFilterAction({ pathname: "/page-visits", currentQuery: "", saved })).toEqual({
      type: "restore",
      query: "traffic=js_confirmed&city=Mumbai",
    });

    // Only the marker clears it.
    expect(
      decideFilterAction({
        pathname: "/page-visits",
        currentQuery: `${CLEAR_FILTERS_PARAM}=1`,
        saved,
      }),
    ).toEqual({ type: "reset", saved: { "/page-visits": "" } });
  });

  it("a reset always redirects (via its own action type), even if already cleared", () => {
    expect(
      decideFilterAction({
        pathname: "/page-visits",
        currentQuery: `${CLEAR_FILTERS_PARAM}=1`,
        saved: { "/page-visits": "" },
      }),
    ).toEqual({ type: "reset", saved: { "/page-visits": "" } });
  });

  it("an empty remembered value never gets restored — the reset stays stuck", () => {
    expect(
      decideFilterAction({ pathname: "/listings", currentQuery: "", saved: { "/listings": "" } }),
    ).toEqual({ type: "noop" });
  });

  it("keeps each path's filters independent", () => {
    const saved = { "/listings": "status=active" };
    expect(decideFilterAction({ pathname: "/users", currentQuery: "role=admin", saved })).toEqual({
      type: "write",
      saved: { "/listings": "status=active", "/users": "role=admin" },
    });
  });

  it("evicts the least-recently-touched path once over the cap", () => {
    const saved: Record<string, string> = {};
    for (let i = 0; i < 40; i++) saved[`/path-${i}`] = "q=1";

    const action = decideFilterAction({ pathname: "/path-40", currentQuery: "q=1", saved });

    expect(action.type).toBe("write");
    if (action.type !== "write") throw new Error("unreachable");
    expect(Object.keys(action.saved)).toHaveLength(40);
    expect(action.saved["/path-0"]).toBeUndefined(); // oldest, evicted
    expect(action.saved["/path-40"]).toBe("q=1"); // newest, present
  });
});
