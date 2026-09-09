"use client";

import { Fragment, useState } from "react";
import type { AdminConversationSummaryDto, MessageDto } from "@bhavano/types";
import { fetchConversationMessagesAction } from "@/app/actions/admin";
import { formatDateTime } from "@/lib/formatDateTime";

const dash = <span style={{ color: "var(--muted)" }}>—</span>;

/** A listing's buyer-inquiry conversations, admin-facing — click a row to expand the full thread
 * inline. Threads are fetched on demand (not pre-loaded for the whole page) since most rows on a
 * page of 25 never get expanded; fetched once per conversation id and cached in local state so
 * re-toggling the same row doesn't refetch. `"use client"` only because of that click/expand
 * state — everything else about this table is as plain as AdminListingsTable. */
export function ConversationsTable({
  listingId,
  items,
  ownerId,
  ownerName,
}: {
  listingId: string;
  items: AdminConversationSummaryDto[];
  ownerId: string;
  ownerName: string | null;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [threads, setThreads] = useState<Record<string, MessageDto[] | "loading" | "error">>({});

  async function onToggle(conversationId: string) {
    if (expandedId === conversationId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(conversationId);
    if (threads[conversationId] !== undefined) return;

    setThreads((prev) => ({ ...prev, [conversationId]: "loading" }));
    const result = await fetchConversationMessagesAction(listingId, conversationId);
    setThreads((prev) => ({
      ...prev,
      [conversationId]: result.success ? result.messages : "error",
    }));
  }

  if (items.length === 0) {
    return <p style={{ color: "var(--muted)", fontSize: 14 }}>No buyer messages yet.</p>;
  }

  return (
    <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
        <thead>
          <tr style={{ background: "var(--surface-alt)", textAlign: "left" }}>
            {["Buyer", "Last message", "Started", ""].map((h) => (
              <th key={h} style={thStyle}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((c) => {
            const isOpen = expandedId === c.id;
            return (
              <Fragment key={c.id}>
                <tr
                  onClick={() => onToggle(c.id)}
                  style={{ borderTop: "1px solid var(--border)", cursor: "pointer" }}
                >
                  <td style={tdStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {c.unreadByOwner && (
                        <span
                          title="Owner hasn't read the buyer's latest message"
                          style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--green)", flexShrink: 0 }}
                        />
                      )}
                      <span style={{ fontWeight: 700 }}>
                        {c.inquirer.name ?? c.inquirer.phone ?? c.inquirer.email ?? "Unknown"}
                      </span>
                    </div>
                  </td>
                  <td style={{ ...tdStyle, maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.lastMessage?.body ?? dash}
                  </td>
                  <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>{formatDateTime(c.createdAt)}</td>
                  <td style={{ ...tdStyle, color: "var(--green)", fontWeight: 700 }}>{isOpen ? "Hide" : "View"}</td>
                </tr>
                {isOpen && (
                  <tr>
                    <td colSpan={4} style={{ padding: 0, borderTop: "1px solid var(--border)" }}>
                      <MessageThread
                        state={threads[c.id]}
                        inquirerName={c.inquirer.name ?? c.inquirer.phone ?? c.inquirer.email ?? "Buyer"}
                        ownerId={ownerId}
                        ownerName={ownerName ?? "Owner"}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Bubble styling reuses ModerationPanel's CSS, but not its "align by senderId === currentUserId"
 * logic — the admin viewing this is a spectator of a buyer↔seller thread, neither party is "me",
 * so side alone (unlike a two-party thread) doesn't say who's who without a label. */
function MessageThread({
  state,
  inquirerName,
  ownerId,
  ownerName,
}: {
  state: MessageDto[] | "loading" | "error" | undefined;
  inquirerName: string;
  ownerId: string;
  ownerName: string;
}) {
  if (state === undefined || state === "loading") {
    return <p style={{ fontSize: 13, color: "var(--muted)", padding: 16, margin: 0 }}>Loading…</p>;
  }
  if (state === "error") {
    return <p style={{ fontSize: 13, color: "var(--danger)", padding: 16, margin: 0 }}>Failed to load this thread.</p>;
  }
  if (state.length === 0) {
    return <p style={{ fontSize: 13, color: "var(--muted)", padding: 16, margin: 0 }}>No messages yet.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 16, background: "var(--bg)" }}>
      {state.map((m) => {
        const fromOwner = m.senderId === ownerId;
        const label = fromOwner ? `Owner — ${ownerName}` : `Buyer — ${inquirerName}`;
        return (
          <div key={m.id} style={{ alignSelf: fromOwner ? "flex-end" : "flex-start", maxWidth: "80%" }}>
            <div style={{ fontSize: 10.5, color: "var(--muted)", marginBottom: 2, textAlign: fromOwner ? "right" : "left" }}>
              {label}
            </div>
            <div
              style={{
                background: fromOwner ? "var(--green)" : "var(--surface-alt)",
                color: fromOwner ? "var(--on-green)" : "var(--text)",
                borderRadius: 10,
                padding: "8px 12px",
                fontSize: 13.5,
              }}
            >
              {m.body}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 11.5,
  fontWeight: 700,
  color: "var(--muted)",
  whiteSpace: "nowrap",
};
const tdStyle: React.CSSProperties = { padding: "9px 12px", verticalAlign: "top" };
