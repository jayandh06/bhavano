"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { MessageDeletedEvent, MessageDto } from "@bhavano/types";
import { getSocket } from "@/lib/socket";
import { deleteMessageAction, markReadAction, sendFirstMessageAction, sendMessageAction } from "@/app/actions/messaging";
import { useAuthGate } from "./AuthGateProvider";
import { MessageBody } from "./MessageBody";
import { Icon } from "./Icon";

export function MessageThread({
  conversationId,
  listingId,
  accessToken,
  currentUserId,
  initialMessages,
}: {
  /** Null before the first message is sent — no Conversation row exists yet (see
   * docs/plans/message-delete-and-lazy-conversation-creation.md). Nothing is fetched or joined
   * over the socket in that state; onSend() creates the conversation and its first message
   * atomically, then hands off to the real thread at its canonical URL. */
  conversationId: string | null;
  listingId: string;
  accessToken: string;
  currentUserId: string;
  initialMessages: MessageDto[];
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { requireLogin } = useAuthGate();
  const router = useRouter();

  useEffect(() => {
    if (!conversationId) return;
    const socket = getSocket(accessToken);
    socket.emit("join_conversation", { conversationId });

    function onNewMessage(msg: MessageDto) {
      if (msg.conversationId !== conversationId) return;
      setMessages((prev) => [...prev, msg]);
      // Thread is on screen — mark it read now so the header's unread badge doesn't count a
      // message the user is already looking at.
      if (msg.senderId !== currentUserId) markReadAction(conversationId);
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
  }, [conversationId, accessToken, currentUserId]);

  // Scrolls the message list itself rather than calling scrollIntoView, which walks up and
  // scrolls every scrollable ancestor including the window — that dragged the whole page down on
  // mount, pushing the header off-screen so the view opened partway down. Also skipped entirely
  // when there is nothing to scroll to.
  useEffect(() => {
    if (messages.length === 0) return;
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (conversationId) markReadAction(conversationId);
  }, [conversationId]);

  // Auto-grows the composer as the draft gains lines, and collapses it back to one row
  // once onSend() clears the draft — a plain <textarea rows={1}> doesn't resize on its own.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [draft]);

  async function onSend() {
    const body = draft.trim();
    if (!body) return;
    setDraft("");

    if (!conversationId) {
      // No Conversation row exists yet — this call creates it and the message atomically, then
      // the canonical URL takes over (its own mount fetches history and joins the socket).
      const result = await sendFirstMessageAction(listingId, body);
      if (result.requiresLogin) {
        requireLogin({ onSuccess: () => void onSend() });
        return;
      }
      if ("error" in result) {
        setDraft(body);
        return;
      }
      router.replace(`/messages/${result.conversationId}`);
      return;
    }

    // The message arrives back over the socket (sender's own connection is also in the
    // room), so no separate optimistic-append is needed.
    const result = await sendMessageAction(conversationId, body);
    if (result.requiresLogin) requireLogin();
  }

  async function onDelete(messageId: string) {
    if (!window.confirm("Delete this message?")) return;
    const result = await deleteMessageAction(messageId);
    if (result.requiresLogin) requireLogin();
    // The tombstone update arrives back over the socket for a real conversation; nothing else
    // to do here.
  }

  return (
    // On a phone this fills whatever the page shell has left, so the composer below lands on the
    // bottom edge of the viewport and stays there. On desktop it keeps its fixed 70vh box, which
    // sits in a normally scrolling page alongside the footer.
    <div className="flex flex-col flex-1 min-h-0 sm:flex-none sm:h-[70vh]">
      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto py-4 flex flex-col gap-2.5">
        {/* No Conversation row exists until the first message is sent (see this component's
            conversationId doc), so an empty list here is simply "nothing sent yet", not a
            loading or broken state. */}
        {messages.length === 0 && (
          <p className="text-sm text-muted m-0 py-6 text-center">
            No messages yet — say hello to start the conversation.
          </p>
        )}
        {messages.map((m) => {
          const isMine = m.senderId === currentUserId;
          const isDeleted = m.deletedAt != null;
          return (
            <div
              key={m.id}
              className={`group relative rounded-xl px-3.5 py-2 max-w-[70%] text-sm whitespace-pre-line break-words ${
                isMine ? "self-end bg-green text-on-green" : "self-start bg-surface-alt text-text"
              }`}
            >
              {isDeleted ? (
                <span className="italic opacity-80">This message was deleted</span>
              ) : (
                <MessageBody body={m.body!} />
              )}
              {isMine && !isDeleted && (
                <button
                  onClick={() => onDelete(m.id)}
                  aria-label="Delete message"
                  className="absolute -left-7 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 bg-transparent border-0 text-muted hover:text-text cursor-pointer p-1"
                >
                  <Icon name="close" className="text-xs" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* pb for the phone's home-indicator strip: without it the Send button sits under the
          swipe bar on a gesture-navigation device. Zero on anything that has no such inset. */}
      <div className="flex gap-2.5 border-t border-border pt-3 shrink-0 pb-[env(safe-area-inset-bottom)]">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder="Type a message…"
          rows={1}
          className="flex-1 border border-border rounded-[9px] px-3.5 py-3 text-base sm:text-sm outline-none bg-surface text-text resize-none overflow-y-auto max-h-32"
        />
        <button
          onClick={onSend}
          className="bg-green text-on-green border-0 rounded-lg px-5 py-3 text-sm font-bold cursor-pointer"
        >
          Send
        </button>
      </div>
    </div>
  );
}
