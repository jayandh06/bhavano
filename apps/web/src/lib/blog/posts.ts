import { POSTS, parseInline, sortedPosts, type BlogPost } from "@bhavano/types/blogPosts";
/** Blog content is shared with the mobile app, so it lives in `@bhavano/types/blogPosts`; see the
 * authorship and content rules at the top of that file. Re-exported here so web imports stay put. */
export * from "@bhavano/types/blogPosts";


/** The slugs of other posts that `post` links to inside its own text. */
function linkedSlugs(post: BlogPost): Set<string> {
  const slugs = new Set<string>();
  for (const block of post.body) {
    const texts = block.type === "ul" || block.type === "ol" ? block.items : [block.text];
    for (const text of texts) {
      for (const part of parseInline(text)) {
        if (part.kind === "link" && part.href.startsWith("/blog/")) slugs.add(part.href.slice("/blog/".length));
      }
    }
  }
  return slugs;
}

/** Posts worth reading next: the ones this post links to and the ones that link back to it come first (they
 * are on the same topic by construction), then posts of the same format, then the newest. Gives each post its
 * own set of internal links instead of the same three newest posts everywhere, so crawlers and readers
 * reach the whole set. */
export function relatedPosts(post: BlogPost, limit = 4): BlogPost[] {
  const outgoing = linkedSlugs(post);
  const scored = POSTS.filter((p) => p.slug !== post.slug).map((p) => ({
    post: p,
    score: (outgoing.has(p.slug) ? 2 : 0) + (linkedSlugs(p).has(post.slug) ? 2 : 0) + (p.format === post.format ? 1 : 0),
  }));
  const order = new Map(sortedPosts().map((p, i) => [p.slug, i]));
  return scored
    .sort((a, b) => b.score - a.score || (order.get(a.post.slug) ?? 0) - (order.get(b.post.slug) ?? 0))
    .slice(0, limit)
    .map((s) => s.post);
}
