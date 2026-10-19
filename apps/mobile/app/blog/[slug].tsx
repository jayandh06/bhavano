import { Pressable, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { bylineFor, getPost, sortedPosts } from "@bhavano/types/blogPosts";
import { useAppTheme } from "../../src/theme/ThemeContext";
import { BlogBody } from "../../src/components/home/BlogBody";
import { P, StaticPageLayout } from "../../src/components/home/StaticPageLayout";

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

// Mirrors apps/web/src/app/blog/[slug]/page.tsx.
export default function BlogPostScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const post = getPost(String(slug));

  if (!post) {
    return (
      <StaticPageLayout title="Blog">
        <P>We couldn&rsquo;t find that article.</P>
      </StaticPageLayout>
    );
  }

  const more = sortedPosts().filter((p) => p.slug !== post.slug).slice(0, 3);

  return (
    <StaticPageLayout title={post.title} updated={formatDate(post.updated ?? post.published)}>
      <Text style={{ fontSize: 13, color: colors.muted }}>
        {bylineFor(post)}
        {post.author?.role ? `, ${post.author.role}` : ""}
        {post.reviewedBy ? ` · Reviewed by ${post.reviewedBy.name}${post.reviewedBy.role ? `, ${post.reviewedBy.role}` : ""}` : ""} · {post.readingMinutes} min read
      </Text>
      <BlogBody blocks={post.body} />
      {more.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>More from the blog</Text>
          {more.map((p) => (
            <Pressable key={p.slug} onPress={() => router.push({ pathname: "/blog/[slug]", params: { slug: p.slug } })}>
              <Text style={{ fontSize: 13.5, color: colors.green, fontWeight: "700" }}>{p.title}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </StaticPageLayout>
  );
}
