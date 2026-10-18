import { describe, expect, it } from "vitest";
import { DEFAULT_BYLINE, POSTS, bylineFor, getPost, parseInline, sortedPosts, type BlogBlock } from "./posts";

/** Routes a post may link to. Every link in a post is hand-typed, so a typo would ship a dead link
 * to readers and crawlers; this list is the set of real pages (checked against the live site when
 * the posts were written). Add a route here when a new post needs to link to it. */
const KNOWN_ROUTES = new Set([
  "/pg",
  "/coworking",
  "/storage",
  "/contact",
  "/trust",
  "/blog",
  "/moving-to-a-new-city",
  "/rent-lease/apartment",
  "/rent-lease/commercial",
  "/tools/rent-affordability-calculator",
  "/tools/rent-vs-buy-calculator",
  "/tools/emi-calculator",
  "/tools/down-payment-calculator",
  "/tools/home-loan-eligibility-calculator",
  "/tools/area-unit-converter",
  "/post",
  "/blog/rental-agreement-questions",
  "/blog/spotting-a-bad-property-ad",
]);

function textsOf(block: BlogBlock): string[] {
  return block.type === "ul" || block.type === "ol" ? block.items : [block.text];
}

describe("blog posts", () => {
  it("have unique, URL-safe slugs", () => {
    const slugs = POSTS.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("have a title, a description of sensible length and a valid date", () => {
    for (const post of POSTS) {
      expect(post.title.length, post.slug).toBeGreaterThan(10);
      expect(post.description.length, post.slug).toBeLessThanOrEqual(170);
      expect(post.published, post.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      if (post.updated) expect(post.updated >= post.published, post.slug).toBe(true);
      expect(post.body.length, post.slug).toBeGreaterThan(3);
    }
  });

  it("only link to pages that exist", () => {
    for (const post of POSTS) {
      for (const block of post.body) {
        for (const text of textsOf(block)) {
          for (const part of parseInline(text)) {
            if (part.kind === "link") expect(KNOWN_ROUTES.has(part.href), `${post.slug}: ${part.href}`).toBe(true);
          }
        }
      }
    }
  });

  it("contain no malformed link markers", () => {
    for (const post of POSTS) {
      for (const block of post.body) {
        for (const text of textsOf(block)) {
          const stripped = parseInline(text).filter((p) => p.kind === "text").map((p) => p.text).join("");
          expect(stripped, `${post.slug}: ${text.slice(0, 40)}`).not.toMatch(/\]\(|\[[^\]]*\]/);
        }
      }
    }
  });

  it("never credit a made-up author", () => {
    // A byline is a claim about a real person. Authors must be set deliberately, so none of the
    // launch posts may carry one; flip this when a real person's name goes on a post.
    for (const post of POSTS) expect(bylineFor(post)).toBe(post.author ? post.author.name : DEFAULT_BYLINE);
    expect(POSTS.filter((p) => p.author)).toEqual([]);
  });

  it("make no numeric claims about prices, rents or percentages", () => {
    for (const post of POSTS) {
      const all = post.body.flatMap(textsOf).join(" ");
      expect(all, post.slug).not.toMatch(/₹|\bRs\.?\s?\d|\d\s?%|\blakh|\bcrore/i);
    }
  });

  it("sort newest first and can be looked up by slug", () => {
    const sorted = sortedPosts();
    for (let i = 1; i < sorted.length; i++) expect(sorted[i - 1].published >= sorted[i].published).toBe(true);
    expect(getPost(POSTS[0].slug)).toBe(POSTS[0]);
    expect(getPost("nope")).toBeUndefined();
  });
});

describe("parseInline", () => {
  it("splits text and links", () => {
    expect(parseInline("See [PG listings](/pg) now")).toEqual([
      { kind: "text", text: "See " },
      { kind: "link", text: "PG listings", href: "/pg" },
      { kind: "text", text: " now" },
    ]);
  });

  it("leaves text without links alone and ignores external-looking targets", () => {
    expect(parseInline("plain")).toEqual([{ kind: "text", text: "plain" }]);
    expect(parseInline("[x](https://example.com)")).toEqual([{ kind: "text", text: "[x](https://example.com)" }]);
  });
});
