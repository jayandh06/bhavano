"use client";

import { useEffect, useRef, useState } from "react";
import type { MessageDto } from "@bhavano/types";
import { getSocket } from "@/lib/socket";
import { markReadAction, sendMessageAction } from "@/app/actions/messaging";
import { useAuthGate } from "./AuthGateProvider";

export function MessageThread({
  conversationId,
  accessToken,
  currentUserId,
  initialMessages,
}: {
  conversationId: string;
  accessToken: string;
  currentUserId: string;
  initialMessages: MessageDto[];
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const { requireLogin } = useAuthGate();

  useEffect(() => {
    const socket = getSocket(accessToken);
    socket.emit("join_conversation", { conversationId });

    function onNewMessage(msg: MessageDto) {
      if (msg.conversationId !== conversationId) return;
      setMessages((prev) => [...prev, msg]);
      // Thread is on screen — mark it read now so the header's unread badge doesn't count a
      // message the user is already looking at.
      if (msg.senderId !== currentUserId) markReadAction(conversationId);
    }
    socket.on("new_message", onNewMessage);
    return () => {
      socket.off("new_message", onNewMessage);
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
    markReadAction(conversationId);
  }, [conversationId]);

  async function onSend() {
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    // The message arrives back over the socket (sender's own connection is also in the
    // room), so no separate optimistic-append is needed.
    const result = await sendMessageAction(conversationId, body);
    if (result.requiresLogin) requireLogin();
  }

  return (
    // On a phone this fills whatever the page shell has left, so the composer below lands on the
    // bottom edge of the viewport and stays there. On desktop it keeps its fixed 70vh box, which
    // sits in a normally scrolling page alongside the footer.
    <div className="flex flex-col flex-1 min-h-0 sm:flex-none sm:h-[70vh]">
      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto py-4 flex flex-col gap-2.5">
        {/* A conversation can exist with no messages — it is created when a buyer opens contact
            with a seller, before anything is actually sent. Without this the thread renders as a
            blank panel and looks broken rather than empty. */}
        {messages.length === 0 && (
          <p className="text-sm text-muted m-0 py-6 text-center">
            No messages yet — say hello to start the conversation.
          </p>
        )}
        {messages.map((m) => {
          const isMine = m.senderId === currentUserId;
          return (
            <div
              key={m.id}
              className={`rounded-xl px-3.5 py-2 max-w-[70%] text-sm ${
                isMine ? "self-end bg-green text-on-green" : "self-start bg-surface-alt text-text"
              }`}
            >
              {m.body}
            </div>
          );
        })}
      </div>

      {/* pb for the phone's home-indicator strip: without it the Send button sits under the
          swipe bar on a gesture-navigation device. Zero on anything that has no such inset. */}
      <div className="flex gap-2.5 border-t border-border pt-3 shrink-0 pb-[env(safe-area-inset-bottom)]">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSend()}
          placeholder="Type a message…"
          className="flex-1 border border-border rounded-[9px] px-3.5 py-3 text-base sm:text-sm outline-none bg-surface text-text"
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
