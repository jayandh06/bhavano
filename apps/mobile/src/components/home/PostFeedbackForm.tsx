import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import {
  POST_FEEDBACK_DIFFICULTIES,
  POST_FEEDBACK_DIFFICULTY_LABELS,
  POST_FEEDBACK_MAX_SUGGESTION,
  type PostFeedbackDifficulty,
  type PostFeedbackDto,
  type PostFeedbackSource,
} from "@bhavano/types/postFeedback";
import { useAppTheme } from "../../theme/ThemeContext";
import { savePostFeedback } from "../../lib/bffClient";
import { Icon } from "../Icon";

const STAR_WORDS = ["Poor", "Fair", "Good", "Very good", "Excellent"];

/** "How was posting your ad?" — the app counterpart of web's PostFeedbackForm (docs/plans/post-ad-experience-feedback.md). One tap
 * for a rating, saved at once; then optional chips for what was hard, a note, and permission to contact. Used at the bottom of the
 * post-ad success screen (`source="success_screen"`) and on the `/feedback/post/[listingId]` screen that the feedback request opens. */
export function PostFeedbackForm({
  accessToken,
  listingId,
  source,
  initial,
}: {
  accessToken: string;
  listingId: string;
  source: PostFeedbackSource;
  initial?: PostFeedbackDto | null;
}) {
  const { colors } = useAppTheme();
  const [rating, setRating] = useState<number | null>(initial?.rating ?? null);
  const [difficulties, setDifficulties] = useState<PostFeedbackDifficulty[]>(initial?.difficulties ?? []);
  const [suggestion, setSuggestion] = useState(initial?.suggestion ?? "");
  const [canContact, setCanContact] = useState(initial?.canContact ?? false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function tapStar(value: number) {
    setRating(value);
    setError(null);
    try {
      await savePostFeedback(accessToken, { listingId, rating: value, source });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save your rating");
    }
  }

  function toggle(d: PostFeedbackDifficulty) {
    setDifficulties((current) => (current.includes(d) ? current.filter((x) => x !== d) : [...current, d]));
  }

  async function send() {
    setSaving(true);
    setError(null);
    try {
      await savePostFeedback(accessToken, {
        listingId,
        ...(rating ? { rating } : {}),
        difficulties,
        suggestion,
        canContact,
        source,
      });
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send your feedback");
    } finally {
      setSaving(false);
    }
  }

  const box = [styles.card, { borderColor: colors.border, backgroundColor: colors.surface }];

  if (done) {
    return (
      <View style={box}>
        <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>Thank you, this helps us make posting easier.</Text>
      </View>
    );
  }

  return (
    <View style={box} accessibilityLabel="Feedback on posting your ad">
      <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>How was posting your ad?</Text>
      <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2, marginBottom: 10 }}>Tap a star. It takes less than half a minute.</Text>

      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {[1, 2, 3, 4, 5].map((value) => {
          const on = rating !== null && value <= rating;
          return (
            <Pressable
              key={value}
              onPress={() => void tapStar(value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: rating === value }}
              accessibilityLabel={`${value} star${value === 1 ? "" : "s"}, ${STAR_WORDS[value - 1]}`}
              hitSlop={4}
              style={styles.star}
            >
              <Icon name="featured" size={28} color={on ? colors.gold : colors.border} filled={on} />
            </Pressable>
          );
        })}
        {rating !== null && <Text style={{ marginLeft: 8, fontSize: 12, fontWeight: "700", color: colors.textSoft }}>{STAR_WORDS[rating - 1]}</Text>}
      </View>

      {rating !== null && (
        <View style={{ marginTop: 14, gap: 14 }}>
          <View>
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text, marginBottom: 8 }}>Was anything hard? (optional)</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {POST_FEEDBACK_DIFFICULTIES.map((d) => {
                const on = difficulties.includes(d);
                return (
                  <Pressable
                    key={d}
                    onPress={() => toggle(d)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    style={[
                      styles.chip,
                      { borderColor: on ? colors.green : colors.border, backgroundColor: on ? colors.green : colors.bg },
                    ]}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "700", color: on ? colors.onGreen : colors.text }}>
                      {POST_FEEDBACK_DIFFICULTY_LABELS[d]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View>
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text, marginBottom: 6 }}>What should we improve? (optional)</Text>
            <TextInput
              value={suggestion}
              onChangeText={(v) => setSuggestion(v.slice(0, POST_FEEDBACK_MAX_SUGGESTION))}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              placeholder="Anything that confused you, slowed you down or was missing"
              placeholderTextColor={colors.muted}
              style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.bg }]}
            />
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Switch value={canContact} onValueChange={setCanContact} trackColor={{ true: colors.green }} />
            <Text style={{ flex: 1, fontSize: 12, color: colors.textSoft }}>You may contact me about this feedback.</Text>
          </View>

          <Pressable
            onPress={() => void send()}
            disabled={saving}
            style={[styles.send, { backgroundColor: colors.green, opacity: saving ? 0.6 : 1 }]}
          >
            {saving ? <ActivityIndicator color={colors.onGreen} /> : <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 14 }}>Send feedback</Text>}
          </Pressable>
        </View>
      )}

      {error ? <Text style={{ marginTop: 10, fontSize: 12, fontWeight: "700", color: "#b3413a" }}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: "100%", maxWidth: 440, borderWidth: 1, borderRadius: 12, padding: 14 },
  star: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  input: { borderWidth: 1, borderRadius: 10, padding: 10, fontSize: 14, minHeight: 80 },
  send: { alignSelf: "flex-start", borderRadius: 10, paddingVertical: 11, paddingHorizontal: 20, minWidth: 140, alignItems: "center" },
});
