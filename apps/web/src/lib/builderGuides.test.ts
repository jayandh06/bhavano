import { describe, expect, it } from "vitest";
import { BUILDER_GUIDES, BUILDER_GUIDE_SOURCE } from "@bhavano/types/builderGuides";
import { POSTS } from "@bhavano/types/blogPosts";

// These are checks on the *rules* the builder guides were written under, so a later edit
// cannot quietly turn an unranked, figure-free list into a ranking or an advertisement.

const textOf = (post: (typeof BUILDER_GUIDES)[number]): string =>
  post.body.flatMap((b) => ("items" in b ? b.items : [b.text])).join("\n");

describe("builder guides", () => {
  it("covers the eleven main cities, one post each, with distinct slugs", () => {
    expect(BUILDER_GUIDES).toHaveLength(11);
    expect(new Set(BUILDER_GUIDES.map((p) => p.slug)).size).toBe(11);
  });

  it("are published: every one is in POSTS, so the site, sitemap and app carry them", () => {
    const published = new Set(POSTS.map((p) => p.slug));
    for (const post of BUILDER_GUIDES) expect(published.has(post.slug)).toBe(true);
  });

  it("list builders alphabetically, never as a ranking", () => {
    for (const city of BUILDER_GUIDE_SOURCE) {
      const names = city.builders.map((b) => b.name);
      expect([...names].sort((a, b) => a.localeCompare(b))).toEqual(names);
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it("make no ranking or superlative claim", () => {
    for (const post of BUILDER_GUIDES) {
      const text = `${post.title} ${post.description} ${textOf(post)}`.toLowerCase();
      for (const word of ["best", "top ", "leading", "no. 1", "number one", "most trusted", "award", "rated"]) {
        expect(text, `${post.slug} contains "${word}"`).not.toContain(word);
      }
    }
  });

  it("give each builder one short line with no figures", () => {
    for (const city of BUILDER_GUIDE_SOURCE) {
      for (const b of city.builders) {
        expect(b.note, `${city.city}: ${b.name}`).not.toMatch(/\d/);
        expect(b.note.length).toBeLessThanOrEqual(110);
      }
    }
  });

  it("state they are not an endorsement or a ranking, and that nobody paid", () => {
    for (const post of BUILDER_GUIDES) {
      const note = post.body.find((b) => b.type === "note");
      expect(note && "text" in note ? note.text : "").toMatch(/not a ranking/);
      expect(note && "text" in note ? note.text : "").toMatch(/No builder paid/);
    }
  });

  it("keep the description within a search snippet", () => {
    for (const post of BUILDER_GUIDES) expect(post.description.length).toBeLessThanOrEqual(160);
  });

  it("claim no invented author, and name only the real reviewer", () => {
    for (const post of BUILDER_GUIDES) {
      expect(post.author).toBeUndefined();
      expect(post.reviewedBy).toEqual([{ name: "Jayandhan Rajasundaram" }]);
    }
  });

  it("only link to blog posts that exist", () => {
    const slugs = new Set(POSTS.map((p) => p.slug));
    for (const post of BUILDER_GUIDES) {
      for (const [, path] of textOf(post).matchAll(/\]\((\/blog\/[^)]+)\)/g)) {
        expect(slugs.has(path.replace("/blog/", "")), `${post.slug} links ${path}`).toBe(true);
      }
    }
  });
});
