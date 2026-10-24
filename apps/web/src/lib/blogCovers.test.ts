import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { POSTS } from "@bhavano/types/blogPosts";
import { COVER_MOTIFS, COVER_PALETTES, coverFor, motifFor, type CoverShape } from "@bhavano/types/blogCovers";

const W = 200;
const H = 105;

/** The rectangle a shape covers, for keeping every picture inside its canvas. */
function bounds(s: CoverShape): [number, number, number, number] | null {
  switch (s.t) {
    case "rect":
      return [s.x, s.y, s.x + s.w, s.y + s.h];
    case "circle":
      return [s.cx - s.r, s.cy - s.r, s.cx + s.r, s.cy + s.r];
    case "ellipse":
      return [s.cx - s.rx, s.cy - s.ry, s.cx + s.rx, s.cy + s.ry];
    case "poly": {
      const pts = s.pts.trim().split(/\s+/).map((p) => p.split(",").map(Number));
      const xs = pts.map((p) => p[0]);
      const ys = pts.map((p) => p[1]);
      return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    }
    case "path":
      return null; // lines and ticks: drawn by hand inside the scene
  }
}

describe("blog covers", () => {
  it("give every article a drawn scene with alt text and a palette", () => {
    for (const post of POSTS) {
      const scene = coverFor(post);
      expect(scene.shapes.length, post.slug).toBeGreaterThanOrEqual(8);
      expect(scene.alt.length, post.slug).toBeGreaterThan(10);
      expect(COVER_PALETTES).toContain(scene.palette);
    }
  });

  it("draw only shapes, never text", () => {
    const allowed = new Set(["rect", "circle", "ellipse", "poly", "path"]);
    for (const post of POSTS) for (const s of coverFor(post).shapes) expect(allowed.has(s.t), post.slug).toBe(true);
  });

  it("keep every shape inside the picture", () => {
    for (const post of POSTS) {
      for (const s of coverFor(post).shapes) {
        const b = bounds(s);
        if (!b) continue;
        const [x0, y0, x1, y1] = b;
        expect(x0 >= -0.01 && y0 >= -0.01 && x1 <= W + 0.01 && y1 <= H + 0.01, `${post.slug}: ${JSON.stringify(s)}`).toBe(true);
      }
    }
  });

  it("stay inside the picture for any slug, including the random skylines", () => {
    for (let i = 0; i < 300; i++) {
      for (const prefix of ["builders-in-", "plot-", "storage-"]) {
        for (const s of coverFor({ slug: `${prefix}city-${i}` }).shapes) {
          const b = bounds(s);
          if (!b) continue;
          expect(b[0] >= -0.01 && b[1] >= -0.01 && b[2] <= W + 0.01 && b[3] <= H + 0.01, `${prefix}${i}: ${JSON.stringify(s)}`).toBe(true);
        }
      }
    }
  });

  it("only use colours from the palette, and a real tone for every fill", () => {
    const tones = new Set(["bg", "ink", "deep", "mid", "pale", "accent", "accentPale", "white"]);
    for (const post of POSTS) {
      for (const s of coverFor(post).shapes) {
        for (const tone of [("fill" in s ? s.fill : undefined), ("stroke" in s ? s.stroke : undefined)]) {
          if (tone) expect(tones.has(tone), `${post.slug}: ${tone}`).toBe(true);
        }
      }
    }
  });

  it("are drawn the same way every time", () => {
    for (const post of POSTS.slice(0, 10)) expect(JSON.stringify(coverFor(post))).toBe(JSON.stringify(coverFor(post)));
  });

  it("look different from one article to the next", () => {
    const seen = new Set(POSTS.map((p) => JSON.stringify(coverFor(p))));
    expect(seen.size).toBe(POSTS.length);
    // Not all in one colour set: the five are spread across the articles.
    expect(new Set(POSTS.map((p) => coverFor(p).palette)).size).toBeGreaterThanOrEqual(4);
  });

  it("choose a scene by topic, with a fallback for a new article", () => {
    expect(motifFor("pg-hunting-checklist")).toBe("bed");
    expect(motifFor("builders-in-chennai")).toBe("skyline");
    expect(motifFor("rera-explained-for-home-buyers")).toBe("approvals");
    expect(motifFor("a-brand-new-guide-about-selling-your-listing")).toBe("phone");
    expect(motifFor("zzz")).toBe("flats");
  });

  it("use several scenes across the blog, and know every scene it assigns", () => {
    const used = new Set(POSTS.map((p) => motifFor(p.slug)));
    expect(used.size).toBeGreaterThanOrEqual(10);
    for (const motif of used) expect(COVER_MOTIFS).toContain(motif);
  });
});

describe("blog cover photographs", () => {
  const withPhoto = POSTS.filter((p) => p.cover);
  const credits = readFileSync(join(process.cwd(), "../../docs/plans/blog-image-credits.md"), "utf8");

  it("each points at a file that exists, is WebP and is small", () => {
    for (const post of withPhoto) {
      const file = join(process.cwd(), "public", post.cover!.src);
      expect(existsSync(file), `${post.slug}: ${post.cover!.src}`).toBe(true);
      expect(post.cover!.src.endsWith(".webp")).toBe(true);
      expect(statSync(file).size).toBeLessThanOrEqual(110_000);
    }
  });

  it("each has alt text, a credit, a source link and a licence", () => {
    for (const post of withPhoto) {
      const c = post.cover!;
      expect(c.alt.length, post.slug).toBeGreaterThan(10);
      expect(c.credit, post.slug).toBeTruthy();
      expect(c.creditUrl, post.slug).toMatch(/^https:\/\/unsplash\.com\/photos\//);
      expect(c.licence, post.slug).toBeTruthy();
    }
  });

  it("each is recorded in docs/plans/blog-image-credits.md", () => {
    for (const post of withPhoto) {
      expect(credits, post.slug).toContain(post.slug);
      expect(credits, post.slug).toContain(post.cover!.creditUrl!);
    }
  });

  it("builder guides keep their drawn covers", () => {
    for (const post of withPhoto) expect(post.slug.startsWith("established-builders")).toBe(false);
  });
});
