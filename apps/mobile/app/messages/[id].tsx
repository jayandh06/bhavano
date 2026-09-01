import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import type { ConversationDetailDto, MessageDto } from "@bhavano/types";
import { useAppTheme } from "../../src/theme/ThemeContext";
import { useHomeSheets } from "../../src/context/HomeSheetsProvider";
import { useMessagesQuery } from "../../src/lib/queries";
import { fetchConversation, markConversationRead, sendMessage } from "../../src/lib/bffClient";
import { getSocket } from "../../src/lib/socket";

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

  // Which listing this thread is about. Best-effort: a failure costs the header bar below, not
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
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <Stack.Screen options={{ headerShown: true, title: "Conversation" }} />
        <ActivityIndicator color={colors.green} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen
        options={{ headerShown: true, title: conversation?.otherPartyName ?? "Conversation" }}
      />
      {/* The way back to the ad this thread is about.
        *
        * The stack's own back arrow returns wherever you came from, which for someone who tapped
        * "Contact owner" is the listing — but for someone who came from the messages list is the
        * list, and there was then nothing at all pointing at the listing. This is always present
        * and always goes to the same place, so the thread stops being a dead end either way. */}
      {conversation && (
        <Pressable
          onPress={() => router.push(`/listing/${conversation.listing.id}`)}
          style={[styles.listingBar, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
        >
          <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, fontWeight: "700", color: colors.text }}>
            {conversation.listing.title}
          </Text>
          <Text style={{ fontSize: 12, color: colors.green, fontWeight: "700" }}>View ad ›</Text>
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
  listingBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  inputRow: { flexDirection: "row", gap: 10, padding: 16, borderTopWidth: 1 },
  input: { flex: 1, borderWidth: 1, borderRadius: 9, paddingVertical: 10, paddingHorizontal: 14, fontSize: 14 },
  sendButton: { borderRadius: 8, paddingHorizontal: 20, alignItems: "center", justifyContent: "center" },
});
