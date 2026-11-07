import { describe, expect, it } from "vitest";
import { diffList, diffWords } from "./textDiff";

describe("diffWords", () => {
  it("marks added and removed words and keeps the rest", () => {
    expect(diffWords("2 BHK flat near metro", "3 BHK flat near the metro")).toEqual([
      { type: "del", text: "2" },
      { type: "add", text: "3" },
      { type: "same", text: " BHK flat near " },
      { type: "add", text: "the " },
      { type: "same", text: "metro" },
    ]);
  });

  it("is a single same part when nothing changed, and empty for two empty texts", () => {
    expect(diffWords("same text", "same text")).toEqual([{ type: "same", text: "same text" }]);
    expect(diffWords("", "")).toEqual([]);
  });

  it("shows a fully new or fully cleared text as all added or all removed", () => {
    expect(diffWords("", "new")).toEqual([{ type: "add", text: "new" }]);
    expect(diffWords("old", "")).toEqual([{ type: "del", text: "old" }]);
  });
});

describe("diffList", () => {
  it("separates what was added from what was removed", () => {
    expect(diffList(["gym", "pool"], ["pool", "lift"])).toEqual({ added: ["lift"], removed: ["gym"] });
  });
});
