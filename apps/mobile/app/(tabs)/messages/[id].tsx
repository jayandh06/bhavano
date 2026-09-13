import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import type { ConversationDetailDto, MessageDto } from "@bhavano/types";
import { useAppTheme } from "../../../src/theme/ThemeContext";
import { useHomeSheets } from "../../../src/context/HomeSheetsProvider";
import { useMessagesQuery } from "../../../src/lib/queries";
import { fetchConversation, markConversationRead, sendMessage } from "../../../src/lib/bffClient";
import { getSocket } from "../../../src/lib/socket";
import { Icon } from "../../../src/components/Icon";
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
  const [messages, setMessages] = useState<MessageDto[]>([]);
  const [draft, setDraft] = useState("");
  const [conversation, setConversation] = useState<ConversationDetailDto | null>(null);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (initialMessages) setMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    if (!accessToken) return;
    const socket = getSocket(accessToken);
    socket.emit("join_conversation", { conversationId: id });

    function onNewMessage(msg: MessageDto) {
      if (msg.conversationId !== id) return;
      setMessages((prev) => [...prev, msg]);
      // The thread is open in front of the user — clear it straight away so the unread badge
      // doesn't tick up for a message they're already looking at.
      if (msg.senderId !== userId) markConversationRead(accessToken!, id).catch(() => undefined);
    }
    socket.on("new_message", onNewMessage);
    return () => {
      socket.off("new_message", onNewMessage);
    };
  }, [id, accessToken, userId]);

  useEffect(() => {
    if (accessToken) markConversationRead(accessToken, id).catch(() => undefined);
  }, [id, accessToken]);

  // Which listing this thread is about. Best-effort: a failure costs the listing bar below, not
  // the conversation itself, which is the part the user came for.
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

  useEffect(() => {
    listRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  async function onSend() {
    const body = draft.trim();
    if (!body || !accessToken) return;
    setDraft("");
    await sendMessage(accessToken, id, body);
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
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen options={{ headerShown: false }} />
      {/* Kept generic rather than the listing title — a long title in the header's narrow width
          (competing with the back arrow) truncated to an ellipsis, which read as cut off. The
          full title, free to wrap across as many lines as it needs, lives in the bar below
          instead. */}
      <ScreenHeader title="Conversation" onBack={() => router.back()} />
      {/* Never the other participant's name/phone here — same reasoning as the messages list
          (see MessagingService.listConversations): a free-to-read screen can't be what hands out
          who someone is when the whole business is a *paid* contact reveal. The listing is what
          the thread is about either way.
          "View ad" always points at this one listing regardless of entry point — the header's
          own back arrow returns wherever the visitor came from (the listing for "Contact owner",
          the messages list otherwise), which isn't necessarily the listing. */}
      {conversation && (
        <Pressable
          onPress={() => router.push(`/listing/${conversation.listing.id}`)}
          style={[styles.listingBar, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
        >
          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>{conversation.listing.title}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 2, marginTop: 4 }}>
            <Text style={{ fontSize: 13, color: colors.green, fontWeight: "700" }}>View ad</Text>
            <Icon name="chevronRight" size={14} color={colors.green} />
          </View>
        </Pressable>
      )}
      <FlatList
        ref={listRef}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isMine = item.senderId === userId;
          return (
            <View
              style={[
                styles.bubble,
                {
                  alignSelf: isMine ? "flex-end" : "flex-start",
                  backgroundColor: isMine ? colors.green : colors.surfaceAlt,
                },
              ]}
            >
              <Text style={{ color: isMine ? colors.onGreen : colors.text, fontSize: 14 }}>{item.body}</Text>
            </View>
          );
        }}
      />
      <View style={[styles.inputRow, { borderColor: colors.border }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Type a message…"
          placeholderTextColor={colors.muted}
          style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
        />
        <Pressable onPress={onSend} style={[styles.sendButton, { backgroundColor: colors.green }]}>
          <Text style={{ color: colors.onGreen, fontWeight: "700", fontSize: 14 }}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  bubble: { borderRadius: 12, padding: 12, maxWidth: "75%" },
  listingBar: { paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: 1 },
  inputRow: { flexDirection: "row", gap: 10, padding: 16, borderTopWidth: 1 },
  input: { flex: 1, borderWidth: 1, borderRadius: 9, paddingVertical: 10, paddingHorizontal: 14, fontSize: 14 },
  sendButton: { borderRadius: 8, paddingHorizontal: 20, alignItems: "center", justifyContent: "center" },
});
