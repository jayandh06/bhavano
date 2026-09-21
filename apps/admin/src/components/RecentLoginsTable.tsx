"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import type { DeviceType, LoginMethod, UserLoginHistoryPage, UserLoginSummaryDto } from "@bhavano/types";
import { fetchUserLoginHistoryAction } from "@/app/actions/admin";
import { formatDateTime } from "@/lib/formatDateTime";

const dash = <span style={{ color: "var(--muted)" }}>—</span>;

const METHOD_LABELS: Record<LoginMethod, string> = {
  otp: "OTP",
  google: "Google",
  apple: "Apple",
};

const DEVICE_TYPE_LABELS: Record<DeviceType, string> = {
  desktop: "Desktop",
  mobile: "Mobile",
  tablet: "Tablet",
  mobile_app: "Mobile App",
};

/** The recent-logins table body, split out of logins/page.tsx for the same reason as
 * AdminListingsTable/PageVisitsTable: row-expand state (which users' full login history is open,
 * fetched on demand and cached) has to live in a client component. Unlike those two, there's no
 * competing whole-row navigation here today — the only existing link is the user's own name, to
 * /users/[id] — so the whole row is the expand toggle, with that one link stopping propagation
 * instead of a separate toggle button. Multiple rows can stay expanded at once, same as the other
 * two tables. */
export function RecentLoginsTable({ items }: { items: UserLoginSummaryDto[] }) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [histories, setHistories] = useState<Record<string, UserLoginHistoryPage | "loading" | "error">>({});

  async function onToggle(userId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
    if (histories[userId] !== undefined) return;

    setHistories((prev) => ({ ...prev, [userId]: "loading" }));
    const result = await fetchUserLoginHistoryAction(userId);
    setHistories((prev) => ({ ...prev, [userId]: result.success ? result.history : "error" }));
  }

  return (
    <tbody>
      {items.map((row) => {
        const isOpen = expandedIds.has(row.userId);
        return (
          <Fragment key={row.userId}>
            <tr
              onClick={() => onToggle(row.userId)}
              className="admin-table-row"
              style={{ borderTop: "1px solid var(--border)", cursor: "pointer" }}
            >
              <td style={tdStyle}>
                <Link
                  href={`/users/${row.userId}`}
                  onClick={(e) => e.stopPropagation()}
                  style={{ color: "var(--green)", fontWeight: 700, textDecoration: "none" }}
                >
                  {row.userName ?? row.userPhone ?? row.userEmail ?? "Unknown user"}
                </Link>
                <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
                  {[row.userPhone, row.userEmail].filter(Boolean).join(" · ")}
                </div>
              </td>
              <td style={tdStyle}>
                {row.isNewUser ? (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--gold, #b8860b)",
                      border: "1px solid var(--gold, #b8860b)",
                      borderRadius: 6,
                      padding: "2px 8px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    New user
                  </span>
                ) : (
                  dash
                )}
              </td>
              <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>{formatDateTime(row.firstLoginAt)}</td>
              <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>{formatDateTime(row.lastLoginAt)}</td>
              <td style={tdStyle}>{METHOD_LABELS[row.lastLoginMethod]}</td>
              <td style={tdStyle}>{row.lastLoginDevice ? DEVICE_TYPE_LABELS[row.lastLoginDevice] : dash}</td>
              <td style={tdStyle}>{row.hasPostedAd ? "Yes" : "No"}</td>
            </tr>
            {isOpen && (
              <tr>
                <td colSpan={7} style={{ padding: 0, borderTop: "1px solid var(--border)" }}>
                  <LoginHistoryPanel state={histories[row.userId]} />
                </td>
              </tr>
            )}
          </Fragment>
        );
      })}
      {items.length === 0 && (
        <tr style={{ borderTop: "1px solid var(--border)" }}>
          <td colSpan={7} style={{ ...tdStyle, color: "var(--muted)", textAlign: "center", padding: "20px 12px" }}>
            No users match these filters.
          </td>
        </tr>
      )}
    </tbody>
  );
}

function LoginHistoryPanel({ state }: { state: UserLoginHistoryPage | "loading" | "error" | undefined }) {
  if (state === undefined || state === "loading") {
    return <p style={{ fontSize: 13, color: "var(--muted)", padding: 16, margin: 0 }}>Loading…</p>;
  }
  if (state === "error") {
    return <p style={{ fontSize: 13, color: "var(--danger)", padding: 16, margin: 0 }}>Failed to load login history.</p>;
  }

  return (
    <div style={{ padding: 16, background: "var(--bg)" }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 10px" }}>
        Login history — {state.total} login{state.total === 1 ? "" : "s"}
      </h3>
      {state.items.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>No login history recorded.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {state.items.map((e) => (
            <div
              key={e.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                border: "1px solid var(--border)",
                borderRadius: 9,
                padding: "8px 12px",
                background: "var(--surface)",
                fontSize: 13,
              }}
            >
              <span>{formatDateTime(e.createdAt)}</span>
              <span style={{ color: "var(--text-soft)" }}>
                {METHOD_LABELS[e.method]} · {e.device ? DEVICE_TYPE_LABELS[e.device] : "device unknown"}
              </span>
            </div>
          ))}
        </div>
      )}
      {state.total > state.items.length && (
        <p style={{ fontSize: 11.5, color: "var(--muted)", margin: "8px 0 0" }}>
          Showing the {state.items.length} most recent of {state.total}.
        </p>
      )}
    </div>
  );
}

const tdStyle: React.CSSProperties = { padding: "9px 12px", verticalAlign: "top" };
