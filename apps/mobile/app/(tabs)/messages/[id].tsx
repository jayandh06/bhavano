import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import type { ConversationDetailDto } from "@bhavano/types";
import { useAppTheme } from "../../../src/theme/ThemeContext";
import { useHomeSheets } from "../../../src/context/HomeSheetsProvider";
import { useMessagesQuery } from "../../../src/lib/queries";
import { fetchConversation } from "../../../src/lib/bffClient";
import { ConversationThread } from "../../../src/components/home/ConversationThread";
import { ScreenHeader } from "../../../src/components/home/ScreenHeader";
import { GatedScreen } from "../../../src/components/home/GatedScreen";

// Nested under (tabs)/messages/_layout.tsx's own Stack rather than a top-level app/messages/[id]
// route, so pushing here keeps the outer Tabs bar mounted and visible — see _layout.tsx's own
// comment for why.
export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useAppTheme();
  const { accessToken, userId, isLoggedIn } = useHomeSheets();
  const router = useRouter();
  const { data: initialMessages, isLoading, isError, refetch } = useMessagesQuery(accessToken, id);
  const [conversation, setConversation] = useState<ConversationDetailDto | null>(null);

  // Same reason the list refetches on focus: this screen stays mounted under the tab stack, and
  // iOS socket reconnects can miss `new_message` while the thread is open — HTTP refetch heals it.
  useFocusEffect(
    useCallback(() => {
      if (accessToken) void refetch();
    }, [accessToken, refetch]),
  );

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

  // Without these two, a signed-out viewer or a failed fetch fell through to an empty thread,
  // indistinguishable from a conversation with no messages in it.
  if (!isLoggedIn || !accessToken) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="Conversation" onBack={() => router.back()} />
        <GatedScreen title="Conversation" />
      </View>
    );
  }

  if (isError && !initialMessages) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="Conversation" onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 }}>
          <Text style={{ color: colors.muted, fontSize: 14, textAlign: "center" }}>
            Couldn't load this conversation.
          </Text>
          <Pressable
            onPress={() => void refetch()}
            style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 }}
          >
            <Text style={{ color: colors.green, fontSize: 14, fontWeight: "700" }}>Try again</Text>
          </Pressable>
        </View>
      </View>
    );
  }

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
