import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { POST_FEEDBACK_SOURCES, type PostFeedbackDto, type PostFeedbackSource } from "@bhavano/types/postFeedback";
import { useAppTheme } from "../../../src/theme/ThemeContext";
import { useHomeSheets } from "../../../src/context/HomeSheetsProvider";
import { fetchMyPostFeedback } from "../../../src/lib/bffClient";
import { ScreenHeader } from "../../../src/components/home/ScreenHeader";
import { PostFeedbackForm } from "../../../src/components/home/PostFeedbackForm";

/** Where the "How was posting this ad?" message's button (and a push with this path) lands — docs/plans/post-ad-experience-feedback.md.
 * `?src=push|in_app_message` says which brought the owner here; anything else is recorded as a plain link. A listing that is not theirs
 * shows the error. The web page of the same address does the same for old builds and desktop. */
export default function PostFeedbackScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const { accessToken, isLoggedIn, requireLogin } = useHomeSheets();
  const params = useLocalSearchParams<{ listingId: string; src?: string }>();
  const listingId = typeof params.listingId === "string" ? params.listingId : "";
  const source: PostFeedbackSource = POST_FEEDBACK_SOURCES.find((s) => s === params.src && s !== "success_screen") ?? "web_link";

  const [existing, setExisting] = useState<PostFeedbackDto | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!isLoggedIn || !accessToken) {
        requireLogin();
        return;
      }
      let cancelled = false;
      setError(null);
      fetchMyPostFeedback(accessToken, listingId)
        .then((row) => {
          if (!cancelled) setExisting(row);
        })
        .catch(() => {
          if (!cancelled) setError("We could not open this ad's feedback form. It may belong to a different account.");
        });
      return () => {
        cancelled = true;
      };
    }, [isLoggedIn, accessToken, listingId, requireLogin]),
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="How was posting your ad?" onBack={() => router.back()} />
      {!isLoggedIn || !accessToken ? (
        <View style={styles.centered}>
          <Text style={{ color: colors.muted, fontSize: 14, textAlign: "center" }}>Log in to tell us how posting your ad went.</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={{ color: "#c0554b", fontSize: 14, textAlign: "center" }}>{error}</Text>
        </View>
      ) : existing === undefined ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.green} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <PostFeedbackForm accessToken={accessToken} listingId={listingId} source={source} initial={existing} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
});
