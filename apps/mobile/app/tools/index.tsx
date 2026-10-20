import { Pressable, Text } from "react-native";
import { useRouter } from "expo-router";
import { useAppTheme } from "../../src/theme/ThemeContext";
import { P, StaticPageLayout } from "../../src/components/home/StaticPageLayout";
import { TOOLS } from "../../src/components/tools/toolsRegistry";

// Mirrors apps/web/src/app/tools/page.tsx.
export default function ToolsIndexScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  return (
    <StaticPageLayout title="Calculators">
      <P>
        Quick, free calculators to help you plan a purchase or rental — every result here is an estimate, not financial
        advice.
      </P>
      {TOOLS.map((tool) => (
        <Pressable
          key={tool.slug}
          onPress={() => router.push({ pathname: "/tools/[slug]", params: { slug: tool.slug } })}
          style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16, gap: 6, backgroundColor: colors.surface }}
        >
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>{tool.title}</Text>
          <Text style={{ fontSize: 13.5, lineHeight: 20, color: colors.textSoft }}>{tool.description}</Text>
        </Pressable>
      ))}
    </StaticPageLayout>
  );
}
