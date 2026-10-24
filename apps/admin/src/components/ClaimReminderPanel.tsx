"use client";

import { useState } from "react";
import { previewClaimReminderAudienceAction, sendClaimVerificationBulkAction } from "@/app/actions/outreach";
import type { SendClaimVerificationBulkResult } from "@/app/actions/outreach";

/** Contacts per request. Small, so one stuck WhatsApp call cannot hold a long request open and the
 * progress line moves; the server still sends one contact at a time within it. */
const BATCH_SIZE = 10;

interface Filters {
  cityId?: string;
  areaId?: string;
  status?: string;
  businessCategory?: string;
  placesFetchLogId?: string;
}

const inputStyle = {
  border: "1px solid var(--border)",
  borderRadius: 9,
  padding: "8px 10px",
  fontSize: 13.5,
  background: "var(--surface)",
  color: "var(--text)",
  width: 130,
} as const;

const labelStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  fontSize: 11.5,
  fontWeight: 700,
  color: "var(--muted)",
} as const;

function buttonStyle(disabled: boolean, primary: boolean) {
  return {
    background: primary ? "var(--green)" : "transparent",
    color: primary ? "var(--on-green)" : "var(--text)",
    border: primary ? "none" : "1px solid var(--border)",
    borderRadius: 8,
    padding: "9px 14px",
    fontSize: 13.5,
    fontWeight: 700,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.6 : 1,
  } as const;
}

function plural(n: number, one: string, many: string) {
  return n === 1 ? one : many;
}

/** Second / third claim message to businesses that were sent one and still haven't claimed their
 * listing, for the contacts the page filters select. It reuses the same claim message (and the
 * same per-contact checks) as the first one. See docs/plans/claim-reminders.md. */
export function ClaimReminderPanel({ filters, filterLabel }: { filters: Filters; filterLabel: string }) {
  const [reminderNumber, setReminderNumber] = useState("2");
  const [minDays, setMinDays] = useState("7");
  const [limit, setLimit] = useState("100");
  const [preview, setPreview] = useState<{ total: number; items: { id: string; name: string }[] } | null>(null);
  const [busy, setBusy] = useState<"preview" | "sending" | null>(null);
  const [progress, setProgress] = useState<{ done: number; of: number } | null>(null);
  const [results, setResults] = useState<SendClaimVerificationBulkResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const valid =
    Number.isInteger(Number(reminderNumber)) &&
    Number(reminderNumber) >= 2 &&
    Number(reminderNumber) <= 6 &&
    Number.isInteger(Number(minDays)) &&
    Number(minDays) >= 0 &&
    Number(minDays) <= 90 &&
    Number.isInteger(Number(limit)) &&
    Number(limit) >= 1 &&
    Number(limit) <= 300;

  async function onPreview() {
    setBusy("preview");
    setError(null);
    setResults(null);
    const res = await previewClaimReminderAudienceAction({
      ...filters,
      reminderNumber: Number(reminderNumber),
      minDaysSinceLast: Number(minDays),
      limit: Number(limit),
    });
    setBusy(null);
    if (res.success) setPreview(res.audience);
    else setError(res.error);
  }

  async function onSend() {
    if (!preview || preview.items.length === 0) return;
    const ordinal = reminderNumber === "2" ? "second" : reminderNumber === "3" ? "third" : "#" + reminderNumber;
    const count = preview.items.length;
    if (
      !window.confirm(
        "Send the " + ordinal + " claim message (WhatsApp and email) to " + count + " " + plural(count, "business", "businesses") + "? This can't be undone.",
      )
    ) {
      return;
    }
    setBusy("sending");
    setError(null);
    const all: SendClaimVerificationBulkResult[] = [];
    for (let i = 0; i < preview.items.length; i += BATCH_SIZE) {
      setProgress({ done: i, of: preview.items.length });
      all.push(...(await sendClaimVerificationBulkAction(preview.items.slice(i, i + BATCH_SIZE))));
    }
    setProgress(null);
    setResults(all);
    setPreview(null);
    setBusy(null);
  }

  const sent = results?.filter((r) => r.sent).length ?? 0;
  const skipped = (results ?? []).filter((r) => !r.sent);
  const reasons = new Map<string, number>();
  for (const r of skipped) {
    const reason = r.reason ?? "Not sent";
    reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
  }

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 16, marginBottom: 20, background: "var(--surface)" }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Claim reminders</div>
      <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 12px", maxWidth: 760 }}>
        Sends the same claim message again to businesses that were sent one and still haven&rsquo;t claimed their
        listing. It uses the filters below (city, area, category, status
        {filterLabel ? (
          <>
            , currently <strong>{filterLabel}</strong>
          </>
        ) : (
          <>, currently none, so every city</>
        )}
        ) and skips anyone who has claimed, opted out, been suppressed, or been messaged within the number of days you
        set.
      </p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <label style={labelStyle}>
          Message number
          <select value={reminderNumber} onChange={(e) => setReminderNumber(e.target.value)} style={inputStyle}>
            <option value="2">2nd (sent once)</option>
            <option value="3">3rd (sent twice)</option>
            <option value="4">4th</option>
          </select>
        </label>
        <label style={labelStyle}>
          Days since last message
          <input type="number" min={0} max={90} value={minDays} onChange={(e) => setMinDays(e.target.value)} style={inputStyle} />
        </label>
        <label style={labelStyle}>
          Send at most
          <input type="number" min={1} max={300} value={limit} onChange={(e) => setLimit(e.target.value)} style={inputStyle} />
        </label>
        <button onClick={onPreview} disabled={!valid || busy !== null} style={buttonStyle(!valid || busy !== null, false)}>
          {busy === "preview" ? "Checking…" : "Preview who gets it"}
        </button>
      </div>

      {error && <p style={{ fontSize: 13, color: "var(--danger)", margin: "12px 0 0" }}>{error}</p>}

      {preview && (
        <div style={{ marginTop: 14, fontSize: 13 }}>
          <strong>{preview.total}</strong> {plural(preview.total, "business matches", "businesses match")}.
          {preview.total > preview.items.length && (
            <> The first {preview.items.length} would be sent now; run it again for the rest.</>
          )}
          {preview.items.length > 0 && (
            <div style={{ color: "var(--muted)", marginTop: 6, maxWidth: 760 }}>
              {preview.items
                .slice(0, 8)
                .map((i) => i.name)
                .join(", ")}
              {preview.items.length > 8 ? " and " + (preview.items.length - 8) + " more" : ""}
            </div>
          )}
          <div style={{ marginTop: 10 }}>
            <button
              onClick={onSend}
              disabled={busy !== null || preview.items.length === 0}
              style={buttonStyle(busy !== null || preview.items.length === 0, true)}
            >
              {busy === "sending"
                ? "Sending… " + (progress?.done ?? 0) + " of " + (progress?.of ?? preview.items.length)
                : "Send to " + preview.items.length}
            </button>
          </div>
        </div>
      )}

      {results && (
        <div style={{ marginTop: 14, fontSize: 13 }}>
          <strong>{sent}</strong> sent, <strong>{skipped.length}</strong> not sent.
          {[...reasons.entries()].map(([reason, count]) => (
            <div key={reason} style={{ color: "var(--muted)", marginTop: 4 }}>
              {count} × {reason}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
