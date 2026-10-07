"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SendWelcomeResponseDto, UserSummaryDto, WelcomeChannel } from "@bhavano/types";
import { postedByLabel } from "@bhavano/types/sellerType";
import { mergeUsersAction, sendWelcomeAction } from "@/app/actions/users";
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
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);

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
          {selected.size === 2 && (
            <button
              onClick={() => setMergeDialogOpen(true)}
              disabled={pending !== null || Array.from(selected).some((id) => users.find((u) => u.id === id)?.role === "admin")}
              style={{ ...actionButtonStyle, background: "var(--surface-alt)", color: "var(--text)", border: "1px solid var(--border)" }}
              title={
                Array.from(selected).some((id) => users.find((u) => u.id === id)?.role === "admin")
                  ? "Staff accounts can't be merged from here"
                  : undefined
              }
            >
              Merge these 2 users…
            </button>
          )}
        </div>
      )}

      {mergeDialogOpen && selected.size === 2 && (
        <MergeUsersDialog
          users={Array.from(selected).map((id) => users.find((u) => u.id === id)!) as [UserSummaryDto, UserSummaryDto]}
          onClose={() => setMergeDialogOpen(false)}
          onMerged={() => {
            setMergeDialogOpen(false);
            setSelected(new Set());
            router.refresh();
          }}
        />
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
              {["Created", "Name", "Phone", "Email", "Role", "Posts as", "Live ads", "Enquiries", "City", "Notification status", ""].map((h) => (
                <th key={h || "actions"} style={thStyle}>
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
                    {u.name ?? u.phone ?? u.email ?? "View user"}
                  </Link>
                </td>
                <td style={tdStyle}>
                  {u.phone ? (
                    <Link href={`/users/${u.id}`} style={{ color: "var(--green)", fontWeight: 700 }}>
                      {u.phone}
                    </Link>
                  ) : (
                    dash
                  )}
                </td>
                <td style={tdStyle}>
                  {u.email ? (
                    <Link href={`/users/${u.id}`} style={{ color: "var(--green)", fontWeight: 700 }}>
                      {u.email}
                    </Link>
                  ) : (
                    dash
                  )}
                </td>
                <td style={tdStyle}>{u.role}</td>
                <td style={tdStyle}>{postedByLabel(u.sellerType, u.agencyName) ?? dash}</td>
                <td style={{ ...tdStyle, textAlign: "right" }}>{u.liveListings || dash}</td>
                <td style={{ ...tdStyle, textAlign: "right" }}>{u.enquiries || dash}</td>
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
                <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                  {u.role === "admin" ? (
                    dash
                  ) : (
                    <Link
                      href={`/users/${u.id}#delete`}
                      style={{ color: "var(--danger)", fontWeight: 700, fontSize: 12 }}
                    >
                      Delete
                    </Link>
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

/** Confirmation for AdminService.mergeUsers — shows what each account holds (from the already-
 * loaded table rows, no extra fetch needed) so the admin's winner choice is informed, not a
 * coin flip. Unlike the self-service merge a user can trigger on themselves (which re-proves
 * ownership with a fresh OTP/emailed code), nothing here proves these two accounts are really
 * the same person — that judgement is the admin's, which is exactly why a reason is asked for
 * and every merge is logged (UserMergeAction). See docs/plans/account-linking-phone-and-email.md. */
function MergeUsersDialog({
  users,
  onClose,
  onMerged,
}: {
  users: [UserSummaryDto, UserSummaryDto];
  onClose: () => void;
  onMerged: () => void;
}) {
  // Defaults to whichever has more live listings — mirrors AccountMergeService.pickWinner's own
  // "the account holding listings wins" rule, as a starting point the admin can override, not a
  // decision made for them.
  const [winnerId, setWinnerId] = useState(users[0].liveListings >= users[1].liveListings ? users[0].id : users[1].id);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loser = users.find((u) => u.id !== winnerId)!;

  async function onConfirm() {
    setPending(true);
    setError(null);
    const result = await mergeUsersAction(winnerId, loser.id, reason.trim() || undefined);
    setPending(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    onMerged();
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface)",
          borderRadius: 12,
          padding: 20,
          width: "100%",
          maxWidth: 560,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700 }}>Merge these two accounts?</div>
        <p style={{ fontSize: 12.5, color: "var(--muted)", margin: 0 }}>
          The account you pick below keeps its id; everything on the other account (listings, payments,
          messages, favourites, requirements, and more) moves onto it. The other row is never deleted —
          it stays as a retired, merged record. This can&apos;t be undone from here.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {users.map((u) => (
            <label
              key={u.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                border: `1.5px solid ${winnerId === u.id ? "var(--green)" : "var(--border)"}`,
                borderRadius: 8,
                padding: "10px 12px",
                cursor: "pointer",
              }}
            >
              <input type="radio" checked={winnerId === u.id} onChange={() => setWinnerId(u.id)} style={{ marginTop: 3 }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>
                  {u.name ?? u.phone ?? u.email ?? u.id}
                  {winnerId === u.id && <span style={{ color: "var(--green)", fontWeight: 700 }}> — keep this one</span>}
                </span>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>
                  {u.phone ?? dash} · {u.email ?? dash} · {u.liveListings} live ad{u.liveListings === 1 ? "" : "s"} ·{" "}
                  {u.enquiries} enquir{u.enquiries === 1 ? "y" : "ies"} · {u.cityName ?? "no city"} · joined{" "}
                  {formatDateTime(u.createdAt)}
                </span>
              </div>
            </label>
          ))}
        </div>

        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--muted)" }}>Reason (kept for the audit log)</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="e.g. Same person — confirmed by phone, has both a Google and an OTP login"
            style={{
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "8px 10px",
              fontSize: 12.5,
              fontFamily: "inherit",
              resize: "vertical",
            }}
          />
        </label>

        {error && <p style={{ fontSize: 12.5, color: "var(--danger)", margin: 0 }}>{error}</p>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onClose} disabled={pending} style={{ ...actionButtonStyle, background: "transparent", color: "var(--muted)" }}>
            Cancel
          </button>
          <button onClick={() => void onConfirm()} disabled={pending} style={{ ...actionButtonStyle, background: "var(--danger)" }}>
            {pending ? "Merging…" : `Merge into ${users.find((u) => u.id === winnerId)?.name ?? users.find((u) => u.id === winnerId)?.phone ?? "this account"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
