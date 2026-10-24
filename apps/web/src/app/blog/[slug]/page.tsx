import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StaticPageLayout } from "@/components/home/StaticPageLayout";
import { JsonLd } from "@/components/JsonLd";
import { BlogBody } from "@/components/blog/BlogBody";
import { BlogCover } from "@/components/blog/BlogCover";
import { POSTS, bylineFor, getPost, relatedPosts } from "@/lib/blog/posts";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://local.bhavano.com";

type Props = { params: Promise<{ slug: string }> };

/** Every post is known at build time, so each is generated once and served as static HTML. */
export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      publishedTime: post.published,
      ...(post.updated && { modifiedTime: post.updated }),
      // Only a real photograph can be a share image; the drawn covers are SVG, which social sites
      // do not render, so those articles keep the site-wide image.
      ...(post.cover && { images: [{ url: post.cover.src, width: 1200, height: 630, alt: post.cover.alt }] }),
    },
  };
}

/** "A", "A and B" or "A, B and C", each with their role when one is given. */
function reviewersLine(reviewers: { name: string; role?: string }[]): string {
  const parts = reviewers.map((r) => (r.role ? `${r.name}, ${r.role}` : r.name));
  return parts.length <= 1 ? (parts[0] ?? "") : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const url = `${SITE_URL}/blog/${post.slug}`;
  const more = relatedPosts(post, 4);

  return (
    <StaticPageLayout title={post.title} updated={formatDate(post.updated ?? post.published)}>
      <JsonLd
        data={{
          "@type": "BlogPosting",
          headline: post.title,
          description: post.description,
          url,
          ...(post.cover && { image: `${SITE_URL}${post.cover.src}` }),
          mainEntityOfPage: url,
          datePublished: post.published,
          dateModified: post.updated ?? post.published,
          author: post.author
            ? { "@type": "Person", name: post.author.name }
            : { "@type": "Organization", name: "Bhavano", url: SITE_URL },
          publisher: { "@type": "Organization", name: "Bhavano", url: SITE_URL },
        }}
      />
      <JsonLd
        data={{
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Blog", item: `${SITE_URL}/blog` },
            { "@type": "ListItem", position: 2, name: post.title, item: url },
          ],
        }}
      />

      <p className="m-0 text-[13px] text-muted">
        {bylineFor(post)}
        {post.author?.role ? `, ${post.author.role}` : ""}
        {post.reviewedBy && post.reviewedBy.length > 0 && <> · Reviewed by {reviewersLine(post.reviewedBy)}</>}{" "}
        · {post.readingMinutes} min read ·{" "}
        <Link href="/blog" className="text-green font-bold">
          All articles
        </Link>
      </p>

      <figure className="m-0">
        <BlogCover post={post} eager className="max-w-[760px] rounded-xl overflow-hidden" />
        {post.cover?.credit && (
          <figcaption className="mt-1.5 text-[11.5px] text-muted">
            Photo:{" "}
            {post.cover.creditUrl ? (
              <a href={post.cover.creditUrl} rel="noopener noreferrer nofollow" className="underline">
                {post.cover.credit}
              </a>
            ) : (
              post.cover.credit
            )}
            {post.cover.licence ? ` (${post.cover.licence})` : ""}
          </figcaption>
        )}
      </figure>

      <BlogBody blocks={post.body} />

      {more.length > 0 && (
        <section>
          <h2 className="text-[15px] font-bold text-text m-0 mb-2">Related guides</h2>
          <ul className="m-0 pl-5 flex flex-col gap-1">
            {more.map((p) => (
              <li key={p.slug}>
                <Link href={`/blog/${p.slug}`} className="text-green font-bold">
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </StaticPageLayout>
  );
}
