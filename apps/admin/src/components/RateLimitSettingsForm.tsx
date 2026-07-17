"use client";

import { useState } from "react";
import type { RateLimitSettingsDto } from "@bhavano/types";
import { updateRateLimitsAction } from "@/app/actions/admin";

export function RateLimitSettingsForm({ initial }: { initial: RateLimitSettingsDto }) {
  const [publishLimit, setPublishLimit] = useState(String(initial.publishLimit));
  const [publishWindowMinutes, setPublishWindowMinutes] = useState(String(initial.publishWindowMinutes));
  const [viewLimit, setViewLimit] = useState(String(initial.viewLimit));
  const [viewWindowMinutes, setViewWindowMinutes] = useState(String(initial.viewWindowMinutes));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const parsed = {
    publishLimit: Number(publishLimit),
    publishWindowMinutes: Number(publishWindowMinutes),
    viewLimit: Number(viewLimit),
    viewWindowMinutes: Number(viewWindowMinutes),
  };
  const valid = Object.values(parsed).every((n) => Number.isInteger(n) && n > 0);

  async function onSave() {
    setSaving(true);
    setMessage(null);
    const result = await updateRateLimitsAction(parsed);
    setSaving(false);
    setMessage(
      result.success ? { type: "success", text: "Rate limits updated." } : { type: "error", text: result.error },
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 16, background: "var(--surface)" }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Publishing</div>
        <div style={{ display: "flex", gap: 12 }}>
          <Field label="Max listings" value={publishLimit} onChange={setPublishLimit} />
          <Field label="Per (minutes)" value={publishWindowMinutes} onChange={setPublishWindowMinutes} />
        </div>
      </div>

      <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 16, background: "var(--surface)" }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Viewing</div>
        <div style={{ display: "flex", gap: 12 }}>
          <Field label="Max views" value={viewLimit} onChange={setViewLimit} />
          <Field label="Per (minutes)" value={viewWindowMinutes} onChange={setViewWindowMinutes} />
        </div>
      </div>

      {message && (
        <p style={{ fontSize: 13, color: message.type === "success" ? "var(--green)" : "var(--danger)", margin: 0 }}>
          {message.text}
        </p>
      )}

      <button
        onClick={onSave}
        disabled={saving || !valid}
        style={{
          background: "var(--green)",
          color: "var(--on-green)",
          border: "none",
          borderRadius: 8,
          padding: 13,
          fontSize: 14,
          fontWeight: 700,
          cursor: "pointer",
          opacity: saving || !valid ? 0.6 : 1,
        }}
      >
        {saving ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ flex: 1 }}>
      <label style={{ display: "block", fontSize: 11.5, color: "var(--muted)", marginBottom: 6, fontWeight: 700 }}>
        {label}
      </label>
      <input
        type="number"
        min={1}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ""))}
        style={{
          width: "100%",
          border: "1px solid var(--border)",
          borderRadius: 9,
          padding: "10px 12px",
          fontSize: 14,
          outline: "none",
          background: "var(--surface)",
          color: "var(--text)",
        }}
      />
    </div>
  );
}
