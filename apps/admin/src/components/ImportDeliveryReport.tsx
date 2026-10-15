"use client";

import { useState } from "react";
import { applyDeliveryReportAction } from "@/app/actions/outreach";
import { parseDeliveryReport, summariseReport } from "@/lib/deliveryReport";

const button: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "var(--text-soft)",
  background: "none",
  border: "1px solid var(--text-soft)",
  borderRadius: 8,
  padding: "6px 12px",
  cursor: "pointer",
};

/** Syncs an MSG91 delivery report into Bhavano. Until delivery webhooks exist, a message MSG91
 * accepted stays `sent` forever, even when it then failed (a real first run: 16 delivered, 15
 * failed, every row still `sent`). Download the report from MSG91, choose the file here, and each
 * message is matched on its request id and marked delivered or failed with MSG91's own reason.
 *
 * The tickbox is opt-in because it is an inference: a message rejected within a second with no
 * reason looks like a DND number, but nothing in the report says so. Failures that name a reason
 * (absent subscriber, network issue) are temporary and are never blocked. */
export function ImportDeliveryReport() {
  const [open, setOpen] = useState(false);
  const [block, setBlock] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setMessage(null);
    const parsed = parseDeliveryReport(await file.text());
    if ("error" in parsed) {
      setError(parsed.error);
      return;
    }
    setPending(true);
    const result = await applyDeliveryReportAction(parsed.rows, block);
    setPending(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    const r = result.result;
    setMessage(
      `${summariseReport(parsed.rows)}. Matched ${r.matched} to our sends (${r.unmatched} not ours or not found` +
        `${r.pending > 0 ? `, ${r.pending} still pending` : ""}). Marked ${r.delivered} delivered, ${r.failed} failed` +
        `${block ? `; blocked ${r.blocked} number${r.blocked === 1 ? "" : "s"}` : ""}.`,
    );
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={button} title="Sync an MSG91 delivery report into the send history">
        Import delivery report
      </button>
    );
  }

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: 10,
        maxWidth: 340,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        textAlign: "left",
      }}
    >
      <span style={{ fontSize: 12, color: "var(--muted)" }}>
        Choose the MSG91 delivery report (CSV or tab-separated). Messages are matched by request id.
      </span>
      <input type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" onChange={onFile} disabled={pending} style={{ fontSize: 12 }} />
      <label style={{ fontSize: 12, color: "var(--muted)", display: "flex", gap: 6, alignItems: "flex-start" }}>
        <input type="checkbox" checked={block} onChange={(e) => setBlock(e.target.checked)} disabled={pending} />
        <span>
          Also block numbers whose message failed with no reason (likely DND), so they aren&apos;t sent to
          again. Failures with a reason are never blocked.
        </span>
      </label>
      {pending && <span style={{ fontSize: 12 }}>Importing…</span>}
      {error && <span style={{ fontSize: 12, color: "#b3413a" }}>{error}</span>}
      {message && <span style={{ fontSize: 12, color: "var(--green)" }}>{message}</span>}
      <button onClick={() => setOpen(false)} style={{ ...button, alignSelf: "flex-start" }} disabled={pending}>
        Close
      </button>
    </div>
  );
}
