"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import type { AdminConversationRowDto, MessageDto } from "@bhavano/types";
import { fetchAnyConversationMessagesAction } from "@/app/actions/admin";
import { formatDateTime } from "@/lib/formatDateTime";

const dash = <span style={{ color: "var(--muted)" }}>—</span>;

type Person = { id: string; name: string | null; phone: string | null; email: string | null };

function personLabel(p: Person): string {
  return p.name ?? p.phone ?? p.email ?? "Unknown";
}

const TYPE_LABELS: Record<AdminConversationRowDto["type"], string> = {
  inquiry: "Enquiry",
  moderation: "Moderation (staff)",
  announcement: "Announcement (staff)",
};

/** Every conversation on the platform: who messaged whom, about which listing. Click a row to read the thread
 * (fetched on demand and cached, like the per-listing ConversationsTable). Each name links to that person's
 * Messages, so one click shows everything they sent or received. */
export function MessagesTable({ items, linkParams }: { items: AdminConversationRowDto[]; linkParams: string }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [threads, setThreads] = useState<Record<string, MessageDto[] | "loading" | "error">>({});

  async function onToggle(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (threads[id] !== undefined) return;
    setThreads((prev) => ({ ...prev, [id]: "loading" }));
    const result = await fetchAnyConversationMessagesAction(id);
    setThreads((prev) => ({ ...prev, [id]: result.success ? result.messages : "error" }));
  }

  if (items.length === 0) {
    return <p style={{ color: "var(--muted)", fontSize: 14, padding: 16 }}>No conversations match these filters.</p>;
  }

  return (
    <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
        <thead>
          <tr style={{ background: "var(--surface-alt)", textAlign: "left" }}>
            {["Started", "From (buyer)", "To (owner)", "Listing", "Last message", "Msgs", ""].map((h) => (
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
                <tr onClick={() => onToggle(c.id)} style={{ borderTop: "1px solid var(--border)", cursor: "pointer" }}>
                  <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                    {formatDateTime(c.createdAt)}
                    {c.type !== "inquiry" && (
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{TYPE_LABELS[c.type]}</div>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <PersonLink person={c.inquirer} linkParams={linkParams} unread={c.unreadByOwner} />
                  </td>
                  <td style={tdStyle}>
                    <PersonLink person={c.poster} linkParams={linkParams} />
                  </td>
                  <td style={{ ...tdStyle, maxWidth: 240 }}>
                    <Link
                      href={`/listings/${c.listing.id}`}
                      onClick={(e) => e.stopPropagation()}
                      style={{ color: "var(--green)", fontWeight: 700 }}
                    >
                      {c.listing.title}
                    </Link>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>
                      {c.listing.area}, {c.listing.cityName}
                    </div>
                  </td>
                  <td style={{ ...tdStyle, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.lastMessage?.body ?? dash}
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>{formatDateTime(c.lastMessageAt)}</div>
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{c.messageCount || dash}</td>
                  <td style={{ ...tdStyle, color: "var(--green)", fontWeight: 700 }}>{isOpen ? "Hide" : "View"}</td>
                </tr>
                {isOpen && (
                  <tr>
                    <td colSpan={7} style={{ padding: 0, borderTop: "1px solid var(--border)" }}>
                      <Thread state={threads[c.id]} row={c} />
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

function PersonLink({ person, linkParams, unread }: { person: Person; linkParams: string; unread?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {unread && (
        <span
          title="The owner hasn't read this buyer's latest message"
          style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--green)", flexShrink: 0 }}
        />
      )}
      <div>
        <Link
          href={`/messages?userId=${encodeURIComponent(person.id)}&userLabel=${encodeURIComponent(personLabel(person))}${linkParams}`}
          onClick={(e) => e.stopPropagation()}
          title="Everything this person sent or received"
          style={{ color: "var(--text)", fontWeight: 700 }}
        >
          {personLabel(person)}
        </Link>
        {person.phone && person.name && <div style={{ fontSize: 11, color: "var(--muted)" }}>{person.phone}</div>}
      </div>
    </div>
  );
}

function Thread({ state, row }: { state: MessageDto[] | "loading" | "error" | undefined; row: AdminConversationRowDto }) {
  if (state === undefined || state === "loading") {
    return <p style={{ fontSize: 13, color: "var(--muted)", padding: 16, margin: 0 }}>Loading…</p>;
  }
  if (state === "error") {
    return <p style={{ fontSize: 13, color: "var(--danger)", padding: 16, margin: 0 }}>Failed to load this thread.</p>;
  }
  if (state.length === 0) {
    return <p style={{ fontSize: 13, color: "var(--muted)", padding: 16, margin: 0 }}>No messages yet.</p>;
  }
  const isEnquiry = row.type === "inquiry";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 16, background: "var(--bg)" }}>
      {state.map((m) => {
        const fromBuyer = m.senderId === row.inquirer.id;
        const sender = fromBuyer ? row.inquirer : m.senderId === row.poster.id ? row.poster : null;
        const name = sender ? personLabel(sender) : "Bhavano staff";
        const label = isEnquiry ? `${fromBuyer ? "Buyer" : "Owner"} — ${name}` : name;
        return (
          <div key={m.id} style={{ alignSelf: fromBuyer ? "flex-start" : "flex-end", maxWidth: "80%" }}>
            <div style={{ fontSize: 10.5, color: "var(--muted)", marginBottom: 2, textAlign: fromBuyer ? "left" : "right" }}>
              {label} · {formatDateTime(m.createdAt)}
              {m.deletedAt ? " · deleted by sender" : ""}
            </div>
            <div
              style={{
                background: fromBuyer ? "var(--surface-alt)" : "var(--green)",
                color: fromBuyer ? "var(--text)" : "var(--on-green)",
                borderRadius: 10,
                padding: "8px 12px",
                fontSize: 13.5,
                whiteSpace: "pre-wrap",
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
