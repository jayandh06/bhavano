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
  const bottomRef = useRef<HTMLDivElement>(null);
  const { requireLogin } = useAuthGate();

  useEffect(() => {
    const socket = getSocket(accessToken);
    socket.emit("join_conversation", { conversationId });

    function onNewMessage(msg: MessageDto) {
      if (msg.conversationId === conversationId) setMessages((prev) => [...prev, msg]);
    }
    socket.on("new_message", onNewMessage);
    return () => {
      socket.off("new_message", onNewMessage);
    };
  }, [conversationId, accessToken]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
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
    <div className="flex flex-col h-[70vh]">
      <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-2.5">
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
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2.5 border-t border-border pt-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSend()}
          placeholder="Type a message…"
          className="flex-1 border border-border rounded-[9px] px-3.5 py-3 text-sm outline-none bg-surface text-text"
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
