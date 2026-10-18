import { Linking, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { parseInline, type BlogBlock } from "@bhavano/types/blogPosts";
import { useAppTheme } from "../../theme/ThemeContext";
import { appWebUrl } from "../../lib/appWebUrl";

/** Website paths a post may link to that already have a native screen; anything else opens the
 * website, since most of the site's landing pages have no app equivalent. */
const APP_SCREEN_FOR_SITE_PATH: Record<string, Href> = {
  "/blog": "/blog",
  "/contact": "/contact",
  "/help": "/help",
  "/about": "/about",
};

function openSitePath(router: ReturnType<typeof useRouter>, path: string) {
  const screen = APP_SCREEN_FOR_SITE_PATH[path];
  if (screen) router.push(screen);
  else void Linking.openURL(appWebUrl(path)).catch(() => undefined);
}

function Inline({ text }: { text: string }) {
  const { colors } = useAppTheme();
  const router = useRouter();
  return (
    <>
      {parseInline(text).map((part, i) =>
        part.kind === "link" ? (
          <Text key={i} onPress={() => openSitePath(router, part.href)} style={{ color: colors.green, fontWeight: "700" }}>
            {part.text}
          </Text>
        ) : (
          <Text key={i}>{part.text}</Text>
        ),
      )}
    </>
  );
}

const BODY = { fontSize: 14.5, lineHeight: 23 } as const;

/** Native render of a shared blog post body (`@bhavano/types/blogPosts`), the counterpart of the
 * web's BlogBody. */
export function BlogBody({ blocks }: { blocks: BlogBlock[] }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ gap: 16 }}>
      {blocks.map((block, i) => {
        switch (block.type) {
          case "h2":
            return (
              <Text key={i} style={{ fontSize: 17, fontWeight: "700", color: colors.text, marginTop: 6 }}>
                {block.text}
              </Text>
            );
          case "p":
            return (
              <Text key={i} style={[BODY, { color: colors.textSoft }]}>
                <Inline text={block.text} />
              </Text>
            );
          case "ul":
          case "ol":
            return (
              <View key={i} style={{ gap: 8 }}>
                {block.items.map((item, j) => (
                  <View key={j} style={{ flexDirection: "row", gap: 8, paddingRight: 4 }}>
                    <Text style={[BODY, { color: colors.textSoft, minWidth: 18 }]}>
                      {block.type === "ol" ? `${j + 1}.` : "•"}
                    </Text>
                    <Text style={[BODY, { color: colors.textSoft, flex: 1 }]}>
                      <Inline text={item} />
                    </Text>
                  </View>
                ))}
              </View>
            );
          case "note":
            return (
              <View
                key={i}
                style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt, borderRadius: 10, padding: 14 }}
              >
                <Text style={{ fontSize: 13.5, lineHeight: 21, color: colors.textSoft }}>
                  <Inline text={block.text} />
                </Text>
              </View>
            );
        }
      })}
    </View>
  );
}
