"use client";

import { Fragment, useState } from "react";
import type { NotificationDaySummaryDto, NotificationLogEntryDto } from "@bhavano/types/notificationLog";
import { fetchNotificationDayDetailAction } from "@/app/actions/admin";
import { formatDateTime } from "@/lib/formatDateTime";

const dash = <span style={{ color: "var(--muted)" }}>—</span>;

const CHANNEL_LABELS: Record<string, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
  push: "Push",
};

/** One row per IST calendar day, copying PageVisitsTable's exact lazy-load-per-row pattern:
 * `expandedDays: Set<string>` tracks which days are open, `details` is a fetch-once cache keyed
 * by date so toggling a day never re-fetches once it's been loaded. */
export function NotificationLogTable({ items }: { items: NotificationDaySummaryDto[] }) {
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [details, setDetails] = useState<Record<string, NotificationLogEntryDto[] | "loading" | "error">>({});

  async function onToggle(date: string) {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
    if (details[date] !== undefined) return;

    setDetails((prev) => ({ ...prev, [date]: "loading" }));
    const result = await fetchNotificationDayDetailAction(date);
    setDetails((prev) => ({ ...prev, [date]: result.success ? result.entries : "error" }));
  }

  return (
    <tbody>
      {items.map((day) => {
        const isOpen = expandedDays.has(day.date);
        const total = day.email + day.whatsapp + day.push;
        return (
          <Fragment key={day.date}>
            <tr style={{ borderTop: "1px solid var(--border)" }}>
              <td style={tdStyle}>
                <button
                  type="button"
                  onClick={() => onToggle(day.date)}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    color: "var(--green)",
                    fontWeight: 700,
                    fontSize: "inherit",
                    textDecoration: "underline",
                  }}
                >
                  {day.date}
                </button>
              </td>
              <td style={tdStyle}>{day.email.toLocaleString()}</td>
              <td style={tdStyle}>{day.whatsapp.toLocaleString()}</td>
              <td style={tdStyle}>{day.push.toLocaleString()}</td>
              <td style={{ ...tdStyle, fontWeight: 700 }}>{total.toLocaleString()}</td>
            </tr>
            {isOpen && (
              <tr>
                <td colSpan={5} style={{ padding: 0, borderTop: "1px solid var(--border)" }}>
                  <DayDetailPanel state={details[day.date]} />
                </td>
              </tr>
            )}
          </Fragment>
        );
      })}
      {items.length === 0 && (
        <tr style={{ borderTop: "1px solid var(--border)" }}>
          <td colSpan={5} style={{ ...tdStyle, color: "var(--muted)", textAlign: "center", padding: "20px 12px" }}>
            No notifications sent in this range.
          </td>
        </tr>
      )}
    </tbody>
  );
}

function DayDetailPanel({ state }: { state: NotificationLogEntryDto[] | "loading" | "error" | undefined }) {
  if (state === undefined || state === "loading") {
    return <p style={{ fontSize: 13, color: "var(--muted)", padding: 16, margin: 0 }}>Loading…</p>;
  }
  if (state === "error") {
    return <p style={{ fontSize: 13, color: "var(--danger)", padding: 16, margin: 0 }}>Failed to load this day&apos;s notifications.</p>;
  }
  if (state.length === 0) {
    return <p style={{ fontSize: 13, color: "var(--muted)", padding: 16, margin: 0 }}>No notifications recorded for this day.</p>;
  }

  return (
    <div style={{ padding: 16, background: "var(--bg)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
        <thead>
          <tr style={{ textAlign: "left" }}>
            <th style={innerThStyle}>Time (IST)</th>
            <th style={innerThStyle}>Kind</th>
            <th style={innerThStyle}>Channel</th>
            <th style={innerThStyle}>User</th>
            <th style={innerThStyle}>Listing</th>
          </tr>
        </thead>
        <tbody>
          {state.map((entry, i) => (
            <tr key={`${entry.userId}-${entry.kind}-${entry.sentAt}-${i}`} style={{ borderTop: "1px solid var(--border)" }}>
              <td style={innerTdStyle}>{formatDateTime(entry.sentAt)}</td>
              <td style={innerTdStyle}>{entry.kind}</td>
              <td style={innerTdStyle}>{CHANNEL_LABELS[entry.channel] ?? entry.channel}</td>
              <td style={innerTdStyle}>
                <a href={`/users/${entry.userId}`} style={{ color: "var(--green)", fontWeight: 700 }}>
                  {entry.userName ?? entry.userPhone ?? entry.userEmail ?? entry.userId}
                </a>
              </td>
              <td style={innerTdStyle}>
                {entry.listingId ? (
                  <a href={`/listings/${entry.listingId}`} style={{ color: "var(--green)", fontWeight: 700 }}>
                    {entry.listingTitle ?? entry.listingId}
                  </a>
                ) : (
                  dash
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const tdStyle: React.CSSProperties = { padding: "9px 12px", verticalAlign: "top" };

const innerThStyle: React.CSSProperties = {
  padding: "6px 10px",
  fontSize: 11,
  fontWeight: 700,
  color: "var(--muted)",
  whiteSpace: "nowrap",
};

const innerTdStyle: React.CSSProperties = { padding: "7px 10px", verticalAlign: "top", whiteSpace: "nowrap" };
