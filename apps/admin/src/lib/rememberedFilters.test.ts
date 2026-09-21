import { describe, expect, it } from "vitest";
import { persistableQuery, restoreTarget, storageKey } from "./rememberedFilters";

describe("storageKey", () => {
  it("namespaces by pathname", () => {
    expect(storageKey("/listings")).toBe("bhavano-admin-filters:/listings");
    expect(storageKey("/listings/abc123")).toBe("bhavano-admin-filters:/listings/abc123");
  });
});

describe("persistableQuery", () => {
  it("keeps filters and view state, drops page", () => {
    expect(persistableQuery("status=active&cols=id,name&page=7")).toBe("status=active&cols=id%2Cname");
  });

  it("is stable on an already-page-less query", () => {
    expect(persistableQuery("status=active")).toBe("status=active");
  });

  it("collapses to empty for a bare query", () => {
    expect(persistableQuery("")).toBe("");
    expect(persistableQuery("page=3")).toBe("");
  });
});

describe("restoreTarget", () => {
  it("restores saved filters onto a bare first visit", () => {
    expect(
      restoreTarget({ pathname: "/listings", currentQuery: "", saved: "status=active", hydrated: false }),
    ).toBe("/listings?status=active");
  });

  it("does nothing when nothing was ever saved", () => {
    expect(restoreTarget({ pathname: "/listings", currentQuery: "", saved: null, hydrated: false })).toBeNull();
  });

  it("never overrides a URL that already carries its own query — a deliberate destination wins", () => {
    expect(
      restoreTarget({ pathname: "/listings", currentQuery: "status=paused", saved: "status=active", hydrated: false }),
    ).toBeNull();
  });

  it("does not restore on a second run for the same visit — lets an in-page reset stick", () => {
    // Same screen, filters just cleared by the visitor (bare query), but this is the second
    // effect run since arriving here — restoring now would fight the reset.
    expect(
      restoreTarget({ pathname: "/listings", currentQuery: "", saved: "status=active", hydrated: true }),
    ).toBeNull();
  });

  /**
   * The regression this was actually filed for: RememberFilters is a singleton mounted once in
   * the root layout, so it never remounts when the visitor navigates between admin screens.
   * `hydrated` therefore can't be a single flag that's true forever after the first-ever effect
   * run — that would mean only the very first screen loaded in a session could ever restore, and
   * every later visit (including a revisit) would look like "hydrated", so it would fall through
   * to the write branch and silently overwrite that screen's saved filters with the bare query.
   *
   * This simulates the actual sequence RememberFilters.tsx runs — restore, then (if it fires) an
   * immediate re-run for the router.replace(), landing on hydrated=true for the reason above —
   * exactly like the component does when it recomputes `hydrated` per pathname rather than once.
   */
  it("still restores a screen's filters after navigating away and back to it", () => {
    let hydratedPath: string | null = null;
    const saved: Record<string, string> = { "/listings": "status=active" };

    function runEffect(pathname: string, currentQuery: string) {
      const hydrated = hydratedPath === pathname;
      const target = restoreTarget({ pathname, currentQuery, saved: saved[pathname] ?? null, hydrated });
      hydratedPath = pathname;
      return target;
    }

    // First arrival at /listings — restores.
    expect(runEffect("/listings", "")).toBe("/listings?status=active");
    // router.replace() lands back on /listings with the restored query — same pathname, so this
    // run must NOT try to restore again (it would loop).
    expect(runEffect("/listings", "status=active")).toBeNull();

    // Navigate to a different screen entirely.
    expect(runEffect("/users", "")).toBeNull();

    // Navigate back to /listings — a fresh arrival, so this must restore again. Before the fix,
    // a single session-wide `hydrated` flag would have made this (incorrectly) return null.
    expect(runEffect("/listings", "")).toBe("/listings?status=active");
  });
});
