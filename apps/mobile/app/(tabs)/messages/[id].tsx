import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import type { ConversationDetailDto } from "@bhavano/types";
import { useAppTheme } from "../../../src/theme/ThemeContext";
import { useHomeSheets } from "../../../src/context/HomeSheetsProvider";
import { useMessagesQuery } from "../../../src/lib/queries";
import { fetchConversation } from "../../../src/lib/bffClient";
import { ConversationThread } from "../../../src/components/home/ConversationThread";
import { ScreenHeader } from "../../../src/components/home/ScreenHeader";

// Nested under (tabs)/messages/_layout.tsx's own Stack rather than a top-level app/messages/[id]
// route, so pushing here keeps the outer Tabs bar mounted and visible — see _layout.tsx's own
// comment for why.
export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useAppTheme();
  const { accessToken, userId } = useHomeSheets();
  const router = useRouter();
  const { data: initialMessages, isLoading } = useMessagesQuery(accessToken, id);
  const [conversation, setConversation] = useState<ConversationDetailDto | null>(null);

  // Which listing this thread is about, for the header/listing bar. Best-effort: a failure
  // costs those, not the conversation itself, which is the part the user came for.
  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    fetchConversation(accessToken, id)
      .then((c) => {
        if (!cancelled) setConversation(c);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [id, accessToken]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="Conversation" onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.green} />
        </View>
      </View>
    );
  }

  return (
    <ConversationThread
      conversationId={id}
      listingId={conversation?.listing.id ?? null}
      listingTitle={conversation?.listing.title ?? null}
      accessToken={accessToken}
      userId={userId}
      initialMessages={initialMessages ?? []}
    />
  );
}
