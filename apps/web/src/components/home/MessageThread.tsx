"use client";

import { useEffect, useRef, useState } from "react";
import type { MessageDto } from "@bhavano/types";
import { getSocket } from "@/lib/socket";
import { markReadAction, sendMessageAction } from "@/app/actions/messaging";

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
    await sendMessageAction(conversationId, body);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "70vh" }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 0", display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.map((m) => {
          const isMine = m.senderId === currentUserId;
          return (
            <div
              key={m.id}
              style={{
                alignSelf: isMine ? "flex-end" : "flex-start",
                background: isMine ? "var(--green)" : "var(--surface-alt)",
                color: isMine ? "var(--on-green)" : "var(--text)",
                borderRadius: 12,
                padding: "8px 14px",
                maxWidth: "70%",
                fontSize: 14,
              }}
            >
              {m.body}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: "flex", gap: 10, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSend()}
          placeholder="Type a message…"
          style={{
            flex: 1,
            border: "1px solid var(--border)",
            borderRadius: 9,
            padding: "12px 14px",
            fontSize: 14,
            outline: "none",
            background: "var(--surface)",
            color: "var(--text)",
          }}
        />
        <button
          onClick={onSend}
          style={{
            background: "var(--green)",
            color: "var(--on-green)",
            border: "none",
            borderRadius: 8,
            padding: "12px 20px",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
