import { Pressable, Text } from "react-native";
import { useRouter } from "expo-router";
import { sortedPosts } from "@bhavano/types/blogPosts";
import { useAppTheme } from "../../src/theme/ThemeContext";
import { useTabHeader } from "../../src/components/home/useTabHeader";
import { P, StaticPageLayout } from "../../src/components/home/StaticPageLayout";

// Mirrors apps/web/src/app/blog/page.tsx. The posts themselves are shared, in @bhavano/types.
export default function BlogIndexScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const tab = useTabHeader("blog");
  return (
    <StaticPageLayout title="Blog" header={tab.header} onScroll={tab.onScroll} overlay={tab.overlay}>
      <P>Plain-language guides to renting, buying and moving, from the Bhavano team.</P>
      {sortedPosts().map((post) => (
        <Pressable
          key={post.slug}
          onPress={() => router.push({ pathname: "/blog/[slug]", params: { slug: post.slug } })}
          style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16, gap: 6, backgroundColor: colors.surface }}
        >
          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.green }}>
            {post.format} · {post.readingMinutes} min read
          </Text>
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>{post.title}</Text>
          <Text style={{ fontSize: 13.5, lineHeight: 20, color: colors.textSoft }}>{post.description}</Text>
        </Pressable>
      ))}
    </StaticPageLayout>
  );
}
