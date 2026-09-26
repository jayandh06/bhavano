import { useEffect, useRef, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { Stack, useIsFocused, useRouter } from "expo-router";
import type { MessageDeletedEvent, MessageDto } from "@bhavano/types";
import { useAppTheme } from "../../theme/ThemeContext";
import { useTabBarHeight } from "../../lib/tabBarHeight";
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
  // See lib/tabBarHeight.ts — the composer sits above the always-mounted tab bar, which the
  // keyboard covers, so it must lift by the keyboard height *minus* the bar to land flush on it.
  const tabBarHeight = useTabBarHeight();
  // The Messages tab stack keeps this screen mounted after you leave a thread (or switch to
  // Home), so socket handlers would still run and auto-mark the conversation read — which made
  // the bottom-tab unread badge flash to 1 then immediately clear. Only mark read while focused.
  const isFocused = useIsFocused();
  const isFocusedRef = useRef(isFocused);
  isFocusedRef.current = isFocused;
  const [messages, setMessages] = useState<MessageDto[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const listRef = useRef<FlatList>(null);
  // Whether the reader is at (or near) the bottom. A new message only pulls the list down when they
  // are — someone scrolled up to reread an older message shouldn't be yanked away from it.
  const nearBottomRef = useRef(true);
  // Set when the user's own message is added, so their send always lands in view.
  const forceScrollRef = useRef(false);
  const contentMeasuredRef = useRef(false);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  function appendMessage(msg: MessageDto) {
    if (msg.senderId === userId) forceScrollRef.current = true;
    setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
  }

  useEffect(() => {
    if (!accessToken || !conversationId) return;
    const socket = getSocket(accessToken);
    function join() {
      socket.emit("join_conversation", { conversationId });
    }
    join();
    // iOS often reconnects after backgrounding without re-joining the room — without this the
    // thread stays open but never receives `new_message` until the screen remounts.
    socket.on("connect", join);

    function onNewMessage(msg: MessageDto) {
      if (msg.conversationId !== conversationId) return;
      appendMessage(msg);
      // Only clear unread while this thread is actually on screen — see isFocused note above.
      if (msg.senderId !== userId && isFocusedRef.current) {
        markConversationRead(accessToken!, conversationId).catch(() => undefined);
      }
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
      socket.off("connect", join);
      socket.off("new_message", onNewMessage);
      socket.off("message_deleted", onMessageDeleted);
    };
  }, [conversationId, accessToken, userId]);

  useEffect(() => {
    if (accessToken && conversationId && isFocused) {
      markConversationRead(accessToken, conversationId).catch(() => undefined);
    }
  }, [conversationId, accessToken, isFocused]);

  // Scrolling is driven by the list's own size callbacks (onContentSizeChange / onLayout below), not
  // by an effect on `messages`. That effect ran right after the state change, before FlatList had
  // laid out the new bubbles — their heights are unknown until then — so scrollToEnd scrolled to the
  // *old* bottom and stopped short of the newest message, both on opening a thread and when a
  // message arrived. Coming back to a thread that stayed mounted needs one explicit jump.
  useEffect(() => {
    if (isFocused) {
      nearBottomRef.current = true;
      listRef.current?.scrollToEnd({ animated: false });
    }
  }, [isFocused]);

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
    // Append from the HTTP response — don't wait on the socket echo. iOS often drops that event
    // (stale join / reconnect), which left "Send" looking like a no-op until leave/return
    // remounted and refetched. Dedupe by id when the socket also delivers the same message.
    const sent = await sendMessage(accessToken, conversationId, body);
    appendMessage(sent);
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

  // KeyboardStickyView (not KeyboardAvoidingView): the composer must pin above the keyboard while
  // the FlatList shrinks above it. KAV + a non-flex FlatList left the input at the content bottom
  // (often under the keyboard / below the tab bar). See app/_layout.tsx's KeyboardProvider.
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
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
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 10, flexGrow: 1, justifyContent: "flex-end" }}
        data={messages}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={100}
        onScroll={({ nativeEvent }) => {
          const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
          nearBottomRef.current = contentSize.height - (contentOffset.y + layoutMeasurement.height) < 120;
        }}
        onContentSizeChange={() => {
          // First measurement: jump without animating (opening the thread should just be at the
          // bottom). Afterwards, follow new content only if the reader was already there, or it's
          // their own message.
          // "First" means the first measurement with messages in it — the list can measure once
          // while still empty, before the thread's history has arrived.
          const first = !contentMeasuredRef.current && messages.length > 0;
          if (messages.length > 0) contentMeasuredRef.current = true;
          if (first || nearBottomRef.current || forceScrollRef.current) {
            forceScrollRef.current = false;
            listRef.current?.scrollToEnd({ animated: !first });
          }
        }}
        // The keyboard opening or closing changes the visible height without changing the content,
        // which would leave the newest message hidden behind it.
        onLayout={() => {
          if (nearBottomRef.current) listRef.current?.scrollToEnd({ animated: false });
        }}
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
      <KeyboardStickyView offset={{ closed: 0, opened: tabBarHeight }}>
        <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.bg }]}>
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
      </KeyboardStickyView>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: { borderRadius: 12, padding: 12, maxWidth: "75%" },
  listingBar: { paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: 1 },
  inputRow: { flexDirection: "row", gap: 10, padding: 16, borderTopWidth: 1 },
  input: { flex: 1, borderWidth: 1, borderRadius: 9, paddingVertical: 10, paddingHorizontal: 14, fontSize: 14, maxHeight: 100 },
  sendButton: { borderRadius: 8, paddingHorizontal: 20, alignItems: "center", justifyContent: "center" },
});
