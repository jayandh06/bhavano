import { describe, expect, it } from "vitest";
import { DEFAULT_BYLINE, POSTS, bylineFor, getPost, parseInline, relatedPosts, sortedPosts, type BlogBlock } from "./posts";

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
  "/blog/ready-to-move-vs-under-construction",
  "/blog/how-to-sell-property-online-in-india",
  "/blog/carpet-built-up-super-built-up-area",
  "/blog/how-to-sell-your-house-or-flat-online",
  "/blog/buying-a-plot-checklist",
  "/blog/a-khata-b-khata-bengaluru",
  "/blog/occupancy-certificate-and-completion-certificate",
  "/blog/bda-approved-sites-bengaluru",
  "/blog/dtcp-approved-plots-explained",
  "/blog/rera-explained-for-home-buyers",
  "/blog/property-approvals-documents-checklist",
  "/bengaluru",
  "/blog/coworking-or-small-office",
  "/blog/write-a-property-listing-that-gets-enquiries",
  "/blog/home-loan-emi-explained",
  "/blog/flat-viewing-checklist",
  "/rent-lease/villa",
  "/rent-lease/house",
  "/buy/commercial",
  "/buy/house",
  "/buy/villa",
  "/buy/apartment",
  "/plot",
  "/blog/rental-agreement-questions",
  "/blog/spotting-a-bad-property-ad",
  "/blog/what-does-bhk-mean",
  "/blog/real-estate-terms-explained-india",
  "/blog/security-deposit-for-rent-in-india",
  "/blog/verify-property-owner-before-paying-token",
  "/blog/freehold-vs-leasehold-property-india",
  "/blog/society-maintenance-charges-explained",
  "/blog/down-payment-for-a-home-loan",
  "/blog/how-to-check-property-title-is-clear",
  "/blog/how-to-calculate-rental-yield",
  "/blog/stamp-duty-and-registration-charges-explained",
  "/blog/capital-gains-tax-on-property-explained",
  "/blog/how-to-find-reliable-tenants",
  "/blog/rent-or-buy-questions",
  "/blog/how-to-sell-property-online-in-india",
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

  it("name only approved real people as reviewers", () => {
    // A "Reviewed by" line is a claim that this person read the post. Add a name here only once they
    // have agreed to it, and attach it only to posts they actually reviewed.
    const APPROVED_REVIEWERS = new Set(["Jayandhan Rajasundaram", "Anitha Narayanasamy"]);
    for (const post of POSTS) {
      for (const reviewer of post.reviewedBy ?? []) expect(APPROVED_REVIEWERS.has(reviewer.name), post.slug).toBe(true);
    }
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

describe("relatedPosts", () => {
  it("never includes the post itself and returns the requested number", () => {
    for (const post of POSTS) {
      const related = relatedPosts(post, 4);
      expect(related.length, post.slug).toBe(4);
      expect(related.map((p) => p.slug), post.slug).not.toContain(post.slug);
      expect(new Set(related.map((p) => p.slug)).size, post.slug).toBe(related.length);
    }
  });

  it("puts a post it links to first", () => {
    const rentYield = getPost("how-to-calculate-rental-yield")!;
    const related = relatedPosts(rentYield, 6).map((p) => p.slug);
    expect(related).toContain("stamp-duty-and-registration-charges-explained");
    expect(related).toContain("home-loan-emi-explained");
  });

  it("gives different posts different sets, not the same newest few everywhere", () => {
    const sets = POSTS.map((p) => relatedPosts(p, 4).map((r) => r.slug).sort().join(","));
    expect(new Set(sets).size).toBeGreaterThan(POSTS.length / 3);
  });
});
