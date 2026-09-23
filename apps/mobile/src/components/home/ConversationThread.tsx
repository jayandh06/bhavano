import { useEffect, useRef, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { Stack, useRouter } from "expo-router";
import type { MessageDeletedEvent, MessageDto } from "@bhavano/types";
import { useAppTheme } from "../../theme/ThemeContext";
import { deleteMessage, markConversationRead, sendFirstMessage, sendMessage } from "../../lib/bffClient";
import { getSocket } from "../../lib/socket";
import { Icon } from "../Icon";
import { MessageBody } from "./MessageBody";
import { ScreenHeader } from "./ScreenHeader";

/** The thread body shared by an existing conversation ([id].tsx) and a not-yet-created one
 * (new/[listingId].tsx) — see docs/plans/message-delete-and-lazy-conversation-creation.md.
 * `conversationId` is null in the latter case: nothing is fetched or joined over the socket
 * until onSend() creates the conversation and its first message atomically, at which point the
 * screen navigates to the real thread's canonical URL. */
export function ConversationThread({
  conversationId,
  listingId,
  listingTitle,
  accessToken,
  userId,
  initialMessages,
}: {
  conversationId: string | null;
  /** Always known synchronously for a not-yet-created thread (it comes straight from the route
   * param) — nullable only because an existing conversation's screen learns it a beat later, via
   * its own fetchConversation call, same as listingTitle. Only ever read from the
   * conversationId === null branch of onSend and the "View ad" button, both cases where it's
   * always already resolved in practice. */
  listingId: string | null;
  listingTitle: string | null;
  accessToken: string | null;
  userId: string | null;
  initialMessages: MessageDto[];
}) {
  const { colors } = useAppTheme();
  const router = useRouter();
  const [messages, setMessages] = useState<MessageDto[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    if (!accessToken || !conversationId) return;
    const socket = getSocket(accessToken);
    socket.emit("join_conversation", { conversationId });

    function onNewMessage(msg: MessageDto) {
      if (msg.conversationId !== conversationId) return;
      setMessages((prev) => [...prev, msg]);
      // The thread is open in front of the user — clear it straight away so the unread badge
      // doesn't tick up for a message they're already looking at.
      if (msg.senderId !== userId) markConversationRead(accessToken!, conversationId).catch(() => undefined);
    }
    function onMessageDeleted(payload: MessageDeletedEvent) {
      if (payload.conversationId !== conversationId) return;
      setMessages((prev) =>
        prev.map((m) => (m.id === payload.messageId ? { ...m, body: null, deletedAt: payload.deletedAt } : m)),
      );
    }
    socket.on("new_message", onNewMessage);
    socket.on("message_deleted", onMessageDeleted);
    return () => {
      socket.off("new_message", onNewMessage);
      socket.off("message_deleted", onMessageDeleted);
    };
  }, [conversationId, accessToken, userId]);

  useEffect(() => {
    if (accessToken && conversationId) markConversationRead(accessToken, conversationId).catch(() => undefined);
  }, [conversationId, accessToken]);

  useEffect(() => {
    listRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  async function onSend() {
    const body = draft.trim();
    if (!body || !accessToken) return;
    setDraft("");

    if (!conversationId) {
      // No Conversation row exists yet — creates it and the message atomically, then hands off
      // to the real thread at its canonical route (which fetches history and joins the socket).
      // listingId is always already resolved here — see its own doc above.
      const result = await sendFirstMessage(accessToken, listingId!, body);
      router.replace(`/messages/${result.conversationId}`);
      return;
    }
    await sendMessage(accessToken, conversationId, body);
  }

  function onDelete(messageId: string) {
    if (!accessToken) return;
    Alert.alert("Delete message?", undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        // The tombstone update arrives back over the socket, same as any other participant's
        // client — no local optimistic state needed.
        onPress: () => void deleteMessage(accessToken, messageId).catch(() => undefined),
      },
    ]);
  }

  // react-native-keyboard-controller's KeyboardAvoidingView, not RN's own — this app's Android
  // keyboard-avoidance (KeyboardAvoidingView + the manifest's windowSoftInputMode="pan") turned
  // out unreliable under SDK 54's mandatory edge-to-edge, a known ecosystem-wide conflict; this
  // library tracks the real keyboard frame via its own native module instead of depending on
  // window resize/pan, so "padding" is now unconditional rather than iOS-only. See
  // app/_layout.tsx's KeyboardProvider for the required root wrapper.
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior="padding">
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader
        title="Conversation"
        onBack={() => router.back()}
        right={
          listingId && (
            <Pressable
              onPress={() => router.push(`/listing/${listingId}`)}
              style={{ flexDirection: "row", alignItems: "center", gap: 2 }}
            >
              <Text style={{ fontSize: 13, color: colors.green, fontWeight: "700" }}>View ad</Text>
              <Icon name="chevronRight" size={14} color={colors.green} />
            </Pressable>
          )
        }
      />
      {listingTitle && (
        <View style={[styles.listingBar, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>{listingTitle}</Text>
        </View>
      )}
      <FlatList
        ref={listRef}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isMine = item.senderId === userId;
          const isDeleted = item.deletedAt != null;
          const bubble = (
            <View
              style={[
                styles.bubble,
                {
                  alignSelf: isMine ? "flex-end" : "flex-start",
                  backgroundColor: isMine ? colors.green : colors.surfaceAlt,
                },
              ]}
            >
              {isDeleted ? (
                <Text style={{ fontStyle: "italic", color: isMine ? colors.onGreen : colors.muted, fontSize: 14 }}>
                  This message was deleted
                </Text>
              ) : (
                <MessageBody body={item.body!} style={{ color: isMine ? colors.onGreen : colors.text, fontSize: 14 }} />
              )}
            </View>
          );
          if (!isMine || isDeleted) return bubble;
          return <Pressable onLongPress={() => onDelete(item.id)}>{bubble}</Pressable>;
        }}
      />
      <View style={[styles.inputRow, { borderColor: colors.border }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Type a message…"
          placeholderTextColor={colors.muted}
          multiline
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
  input: { flex: 1, borderWidth: 1, borderRadius: 9, paddingVertical: 10, paddingHorizontal: 14, fontSize: 14, maxHeight: 100 },
  sendButton: { borderRadius: 8, paddingHorizontal: 20, alignItems: "center", justifyContent: "center" },
});
