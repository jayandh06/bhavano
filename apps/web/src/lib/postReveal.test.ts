import { describe, expect, it } from "vitest";
import type { DetailsIssue } from "@bhavano/types/postDetailsIssues";
import { autoRevealedSections, isAnswered, isSectionAnswered, revealRankOfTarget, revealSectionLabel, sortIssuesByReveal } from "./postReveal";

const issue = (target: string): DetailsIssue => ({ target, text: target, missing: true, group: target === "title" || target === "description" ? "copy" : "other" });
const OPTIONAL = ["pricing", "basics", "amenities"];

describe("revealRankOfTarget", () => {
  it("places each problem in the block it lives in", () => {
    expect(revealRankOfTarget("location")).toBe(0);
    expect(revealRankOfTarget("assisted")).toBe(0);
    expect(revealRankOfTarget("photos")).toBe(1);
    for (const t of ["posted_by", "attr:bedrooms", "price", "brokerage"]) expect(revealRankOfTarget(t), t).toBe(2);
    for (const t of ["title", "description", "owner_type"]) expect(revealRankOfTarget(t), t).toBe(3);
  });
});

describe("sortIssuesByReveal", () => {
  it("puts photos before the essentials, which is not the order the problems are found in", () => {
    const found = ["posted_by", "attr:floor", "price", "photos", "title"].map(issue);
    expect(sortIssuesByReveal(found).map((i) => i.target)).toEqual(["photos", "posted_by", "attr:floor", "price", "title"]);
  });

  it("keeps the original order within a block and does not change its input", () => {
    const found = ["attr:b", "attr:a", "location"].map(issue);
    expect(sortIssuesByReveal(found).map((i) => i.target)).toEqual(["location", "attr:b", "attr:a"]);
    expect(found.map((i) => i.target)).toEqual(["attr:b", "attr:a", "location"]);
  });

  it("makes the first problem always sit in a section that is already showing, for every combination of problems", () => {
    const targets = ["location", "photos", "posted_by", "attr:floor", "price", "owner_type", "title", "description"];
    const sectionOfRank = ["", "media", "essentials", "copy"] as const; // rank 0 (location) is always on the page
    for (let mask = 1; mask < 1 << targets.length; mask++) {
      const found = sortIssuesByReveal(targets.filter((_, i) => mask & (1 << i)).map(issue));
      const shown = autoRevealedSections(found, OPTIONAL, () => false);
      const rank = revealRankOfTarget(found[0].target);
      if (rank > 0) expect(shown.has(sectionOfRank[rank] as "media"), `${found.map((i) => i.target)}`).toBe(true);
    }
  });
});

describe("autoRevealedSections", () => {
  it("shows nothing but the location until it is set", () => {
    expect([...autoRevealedSections([issue("location"), issue("photos")], OPTIONAL, () => false)]).toEqual([]);
  });

  it("shows the photos once the location is set, and the essentials once the photos are in", () => {
    expect([...autoRevealedSections([issue("photos"), issue("attr:floor"), issue("title")], OPTIONAL, () => false)]).toEqual(["media"]);
    expect([...autoRevealedSections([issue("attr:floor"), issue("title")], OPTIONAL, () => false)]).toEqual(["media", "essentials"]);
  });

  it("shows title and description once the essentials are done", () => {
    expect([...autoRevealedSections([issue("title"), issue("description")], OPTIONAL, () => false)]).toEqual(["media", "essentials", "copy"]);
  });

  it("holds the optional sections back until title, description and the owner question are done", () => {
    const shown = autoRevealedSections([issue("owner_type")], OPTIONAL, () => true);
    expect([...shown]).toEqual(["media", "essentials", "copy"]);
  });

  it("then shows the first optional section, and the next only after the previous one has been answered", () => {
    expect([...autoRevealedSections([], OPTIONAL, () => false)]).toEqual(["media", "essentials", "copy", "opt:pricing"]);
    const answered = new Set(["pricing"]);
    expect([...autoRevealedSections([], OPTIONAL, (id) => answered.has(id))]).toEqual([
      "media",
      "essentials",
      "copy",
      "opt:pricing",
      "opt:basics",
    ]);
    const all = new Set(OPTIONAL);
    expect(autoRevealedSections([], OPTIONAL, (id) => all.has(id)).size).toBe(3 + OPTIONAL.length);
  });

  it("copes with a category that has no optional sections", () => {
    expect([...autoRevealedSections([], [], () => false)]).toEqual(["media", "essentials", "copy"]);
  });
});

describe("isAnswered and isSectionAnswered", () => {
  it("counts zero and no as answers, and empty strings and empty lists as not", () => {
    expect(isAnswered("0")).toBe(true);
    expect(isAnswered("no")).toBe(true);
    expect(isAnswered(["a"])).toBe(true);
    for (const empty of [undefined, "", "   ", [] as string[]]) expect(isAnswered(empty)).toBe(false);
  });

  it("calls a section done when any of its fields has an answer", () => {
    expect(isSectionAnswered(["a", "b"], { b: "0" })).toBe(true);
    expect(isSectionAnswered(["a", "b"], { a: "", c: "x" })).toBe(false);
    expect(isSectionAnswered([], { a: "x" })).toBe(false);
  });
});

describe("revealSectionLabel", () => {
  it("names each section", () => {
    expect(revealSectionLabel("media", {})).toBe("Photos and video");
    expect(revealSectionLabel("copy", {})).toBe("Title and description");
    expect(revealSectionLabel("opt:amenities", { amenities: "Amenities" })).toBe("Amenities");
    expect(revealSectionLabel("opt:zzz", {})).toBe("More details");
  });
});
