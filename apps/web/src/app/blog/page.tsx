import Link from "next/link";
import type { Metadata } from "next";
import { StaticPageLayout } from "@/components/home/StaticPageLayout";
import { JsonLd } from "@/components/JsonLd";
import { bylineFor, sortedPosts } from "@/lib/blog/posts";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://local.bhavano.com";
const TITLE = "Bhavano Blog";
const DESCRIPTION =
  "Practical guides for finding a PG, a home, a coworking desk or an office in India: what to check, what to ask, and what to avoid.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/blog" },
};

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function BlogIndexPage() {
  const posts = sortedPosts();

  return (
    <StaticPageLayout title={TITLE}>
      <JsonLd
        data={{
          "@type": "Blog",
          name: TITLE,
          description: DESCRIPTION,
          url: `${SITE_URL}/blog`,
          blogPost: posts.map((p) => ({
            "@type": "BlogPosting",
            headline: p.title,
            url: `${SITE_URL}/blog/${p.slug}`,
            datePublished: p.published,
          })),
        }}
      />

      <p className="m-0">{DESCRIPTION}</p>

      <ul className="list-none m-0 p-0 flex flex-col gap-4">
        {posts.map((post) => (
          <li key={post.slug}>
            <Link
              href={`/blog/${post.slug}`}
              className="block rounded-xl border border-border bg-surface px-5 py-4 no-underline"
            >
              <span className="text-[11.5px] font-bold uppercase tracking-[0.04em] text-green">{post.format}</span>
              <h2 className="font-lora text-[19px] font-semibold text-text m-0 mt-1">{post.title}</h2>
              <p className="m-0 mt-1.5 text-text-soft">{post.description}</p>
              <span className="mt-2 block text-[12.5px] text-muted">
                {bylineFor(post)} · {formatDate(post.published)} · {post.readingMinutes} min read
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <p className="m-0 text-[13px]">
        Looking for something broader? Our{" "}
        <Link href="/moving-to-a-new-city" className="text-green font-bold">
          moving checklist
        </Link>{" "}
        covers housing, work and storage together, and{" "}
        <Link href="/trust" className="text-green font-bold">
          Trust &amp; Safety
        </Link>{" "}
        explains how we check listings.
      </p>
    </StaticPageLayout>
  );
}
