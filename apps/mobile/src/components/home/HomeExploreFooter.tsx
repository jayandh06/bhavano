import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { HOME_STEPS, homeFaqs } from "@bhavano/types/homeContent";
import { sortedPosts } from "@bhavano/types/blogPosts";
import { useAppTheme } from "../../theme/ThemeContext";
import { appWebUrl } from "../../lib/appWebUrl";
import { Icon } from "../Icon";
import { FaqGroup } from "./FaqGroup";

const TOOLS = [
  { path: "/tools/emi-calculator", label: "EMI calculator" },
  { path: "/tools/rent-affordability-calculator", label: "Rent affordability calculator" },
  { path: "/tools/rent-vs-buy-calculator", label: "Rent vs buy calculator" },
  { path: "/tools/area-unit-converter", label: "Area unit converter" },
];

/** What the website's homepage shows below its listings, for the end of the app's feed: how
 * Bhavano works, a way to post, free guides and tools, and the FAQ. The wording comes from
 * `@bhavano/types/homeContent` (shared with the web) so the two never disagree. It is shown only
 * once the feed has run out, because an endless list would never reach a footer. */
export function HomeExploreFooter() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const guides = sortedPosts().slice(0, 4);
  const faqs = homeFaqs([]).map((f) => ({ q: f.question, a: f.answer }));

  const heading = { fontSize: 16, fontWeight: "700" as const, color: colors.text, marginBottom: 10 };
  const row = { flexDirection: "row" as const, alignItems: "center" as const, gap: 8, paddingVertical: 11, minHeight: 44 };

  return (
    <View style={{ paddingHorizontal: 16, marginTop: 28, gap: 26 }}>
      <View>
        <Text style={heading}>How Bhavano works</Text>
        <View style={{ gap: 10 }}>
          {HOME_STEPS.map((step, i) => (
            <View
              key={step.title}
              style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, backgroundColor: colors.surface }}
            >
              <Text style={{ fontSize: 11, fontWeight: "700", color: colors.muted, marginBottom: 2 }}>STEP {i + 1}</Text>
              <Text style={{ fontSize: 14.5, fontWeight: "700", color: colors.text, marginBottom: 3 }}>{step.title}</Text>
              <Text style={{ fontSize: 13.5, lineHeight: 20, color: colors.textSoft }}>{step.text}</Text>
            </View>
          ))}
        </View>
      </View>

      <View>
        <Text style={heading}>Own or manage a property?</Text>
        <Text style={{ fontSize: 13.5, lineHeight: 20, color: colors.textSoft, marginBottom: 10 }}>
          List a house, flat, plot, PG, coworking desk or commercial space and reach people searching in your city.
        </Text>
        <Pressable
          onPress={() => router.push("/post")}
          accessibilityRole="button"
          style={{ alignSelf: "flex-start", backgroundColor: colors.green, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 12 }}
        >
          <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 14 }}>Post your property</Text>
        </Pressable>
      </View>

      <View>
        <Text style={heading}>Free guides</Text>
        {guides.map((post) => (
          <Pressable key={post.slug} onPress={() => router.push({ pathname: "/blog/[slug]", params: { slug: post.slug } })} style={row}>
            <Text style={{ flex: 1, fontSize: 14, color: colors.text }}>{post.title}</Text>
            <Icon name="chevronRight" size={14} color={colors.muted} />
          </Pressable>
        ))}
        <Pressable onPress={() => router.push("/blog")} style={row}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.green }}>All guides</Text>
        </Pressable>
      </View>

      <View>
        <Text style={heading}>Free tools</Text>
        {TOOLS.map((tool) => (
          <Pressable key={tool.path} onPress={() => WebBrowser.openBrowserAsync(appWebUrl(tool.path))} style={row}>
            <Text style={{ flex: 1, fontSize: 14, color: colors.text }}>{tool.label}</Text>
            <Icon name="chevronRight" size={14} color={colors.muted} />
          </Pressable>
        ))}
      </View>

      <FaqGroup title="Frequently asked questions" items={faqs} />
    </View>
  );
}
