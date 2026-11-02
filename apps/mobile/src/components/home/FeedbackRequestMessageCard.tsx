import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import type { FeedbackRequestMessageCardDto } from "@bhavano/types";
import { useAppTheme } from "../../theme/ThemeContext";
import { Icon } from "../Icon";

/** The "How was posting this ad?" message drawn as a card, the sibling of BoostOfferMessageCard: which ad it is about, one line of
 * what is asked, and a Share feedback button that opens the in-app `/feedback/post/[listingId]` screen (docs/plans/post-ad-experience-feedback.md).
 * Builds older than this one do not know the card kind and show the message's plain text, whose last line is the web link. */
export function FeedbackRequestMessageCard({ card }: { card: FeedbackRequestMessageCardDto }) {
  const { colors } = useAppTheme();
  const router = useRouter();

  return (
    <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <View style={[styles.header, { backgroundColor: colors.surfaceAlt }]}>
        {card.imageUrl ? (
          <Image source={{ uri: card.imageUrl }} style={[styles.photo, { backgroundColor: colors.border }]} />
        ) : (
          <View style={[styles.photo, { backgroundColor: colors.border, alignItems: "center", justifyContent: "center" }]}>
            <Icon name="home" size={24} color={colors.muted} />
          </View>
        )}
        <View style={{ flex: 1, justifyContent: "center" }}>
          <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 0.5, color: colors.muted }}>YOUR AD</Text>
          <Text numberOfLines={2} style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>
            {card.title}
          </Text>
          <Text numberOfLines={1} style={{ fontSize: 12.5, color: colors.textSoft, marginTop: 2 }}>
            {card.location}
          </Text>
        </View>
      </View>

      <View style={{ padding: 14, paddingTop: 12 }}>
        <Text style={{ fontFamily: "serif", fontSize: 17, fontWeight: "700", color: colors.text }}>{card.headline}</Text>
        {card.paragraphs.map((paragraph) => (
          <Text key={paragraph} style={{ marginTop: 8, fontSize: 13.5, lineHeight: 20, color: colors.textSoft }}>
            {paragraph}
          </Text>
        ))}
        <Pressable
          onPress={() => router.push(card.ctaPath as never)}
          style={[styles.cta, { backgroundColor: colors.green }]}
          accessibilityRole="button"
        >
          <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 14 }}>{card.ctaLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { alignSelf: "flex-start", width: "100%", maxWidth: 400, borderWidth: 1, borderRadius: 12, overflow: "hidden" },
  header: { flexDirection: "row", gap: 12, padding: 14, paddingBottom: 12 },
  photo: { width: 76, height: 76, borderRadius: 8 },
  cta: { marginTop: 14, borderRadius: 10, paddingVertical: 11, alignItems: "center" },
});
