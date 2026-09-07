"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SendWelcomeResponseDto, UserSummaryDto, WelcomeChannel } from "@bhavano/types";
import { sendWelcomeAction } from "@/app/actions/users";
import { formatDateTime } from "@/lib/formatDateTime";

const dash = <span style={{ color: "var(--muted)" }}>—</span>;

/** Table + row-selection + the bulk "Send welcome email"/"Send welcome WhatsApp" action for the
 * admin Users page. One mechanism covers both "single" and "multiple" users at once — selecting
 * exactly one row and clicking a button is the single-user case, no separate per-row buttons. */
export function UsersTable({ users }: { users: UserSummaryDto[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<WelcomeChannel | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  const allSelected = users.length > 0 && users.every((u) => selected.has(u.id));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(users.map((u) => u.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onSend(channel: WelcomeChannel) {
    const userIds = Array.from(selected);
    if (userIds.length === 0) return;
    setPending(channel);
    setSummary(null);

    const result: SendWelcomeResponseDto | { success: false; error: string } = await sendWelcomeAction(
      userIds,
      channel,
    );
    setPending(null);

    if ("success" in result && result.success === false) {
      setSummary(`Failed: ${result.error}`);
      return;
    }
    const ok = result as SendWelcomeResponseDto;
    const byId = new Map(users.map((u) => [u.id, u]));
    const failedDetail = ok.results
      .filter((r) => !r.success)
      .map((r) => `${byId.get(r.userId)?.name ?? r.userId}: ${r.error}`)
      .join(", ");
    setSummary(
      ok.failed > 0
        ? `${ok.sent} sent, ${ok.failed} failed — ${failedDetail}`
        : `${ok.sent} sent`,
    );
    setSelected(new Set());
    router.refresh();
  }

  return (
    <div>
      {selected.size > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 12,
            padding: "10px 14px",
            border: "1px solid var(--border)",
            borderRadius: 10,
            background: "var(--surface)",
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700 }}>{selected.size} selected</span>
          <button onClick={() => onSend("email")} disabled={pending !== null} style={actionButtonStyle}>
            {pending === "email" ? "Sending…" : "Send welcome email"}
          </button>
          <button onClick={() => onSend("whatsapp")} disabled={pending !== null} style={actionButtonStyle}>
            {pending === "whatsapp" ? "Sending…" : "Send welcome WhatsApp"}
          </button>
        </div>
      )}

      {summary && (
        <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 12px" }}>{summary}</p>
      )}

      <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: "var(--surface-alt)", textAlign: "left" }}>
              <th style={thStyle}>
                <input type="checkbox" checked={allSelected} onChange={toggleAll} />
              </th>
              {["Created", "Name", "Phone", "Email", "Role", "City", "Notification status"].map((h) => (
                <th key={h} style={thStyle}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={tdStyle}>
                  <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggleOne(u.id)} />
                </td>
                <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>{formatDateTime(u.createdAt)}</td>
                <td style={tdStyle}>
                  <Link href={`/users/${u.id}`} style={{ color: "var(--green)", fontWeight: 700 }}>
                    {u.name ?? dash}
                  </Link>
                </td>
                <td style={tdStyle}>{u.phone ?? dash}</td>
                <td style={tdStyle}>{u.email ?? dash}</td>
                <td style={tdStyle}>{u.role}</td>
                <td style={tdStyle}>{u.cityName ?? dash}</td>
                <td style={tdStyle}>
                  {u.welcomed ? (
                    <span style={{ color: "var(--green)", fontWeight: 700 }}>
                      ✓ {u.welcomedChannel ?? "welcomed"}
                      {u.welcomedAt && (
                        <span style={{ color: "var(--muted)", fontWeight: 400 }}> — {formatDateTime(u.welcomedAt)}</span>
                      )}
                    </span>
                  ) : (
                    <span style={{ color: "var(--danger)", fontWeight: 700 }}>Not welcomed</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = { padding: "10px 12px", fontSize: 11.5, fontWeight: 700, color: "var(--muted)", whiteSpace: "nowrap" };
const tdStyle: React.CSSProperties = { padding: "9px 12px", verticalAlign: "top" };

const actionButtonStyle: React.CSSProperties = {
  background: "var(--green)",
  color: "var(--on-green)",
  border: "none",
  borderRadius: 8,
  padding: "7px 12px",
  fontSize: 12.5,
  fontWeight: 700,
  cursor: "pointer",
};
