import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import type { MessageDto } from "@bhavano/types";
import { useAppTheme } from "../../src/theme/ThemeContext";
import { useHomeSheets } from "../../src/context/HomeSheetsProvider";
import { useMessagesQuery } from "../../src/lib/queries";
import { markConversationRead, sendMessage } from "../../src/lib/bffClient";
import { getSocket } from "../../src/lib/socket";

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useAppTheme();
  const { accessToken, userId } = useHomeSheets();
  const { data: initialMessages, isLoading } = useMessagesQuery(accessToken, id);
  const [messages, setMessages] = useState<MessageDto[]>([]);
  const [draft, setDraft] = useState("");
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (initialMessages) setMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    if (!accessToken) return;
    const socket = getSocket(accessToken);
    socket.emit("join_conversation", { conversationId: id });

    function onNewMessage(msg: MessageDto) {
      if (msg.conversationId === id) setMessages((prev) => [...prev, msg]);
    }
    socket.on("new_message", onNewMessage);
    return () => {
      socket.off("new_message", onNewMessage);
    };
  }, [id, accessToken]);

  useEffect(() => {
    if (accessToken) markConversationRead(accessToken, id).catch(() => undefined);
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
      <Stack.Screen options={{ headerShown: true, title: "Conversation" }} />
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
  inputRow: { flexDirection: "row", gap: 10, padding: 16, borderTopWidth: 1 },
  input: { flex: 1, borderWidth: 1, borderRadius: 9, paddingVertical: 10, paddingHorizontal: 14, fontSize: 14 },
  sendButton: { borderRadius: 8, paddingHorizontal: 20, alignItems: "center", justifyContent: "center" },
});
