"use client";

import { useState } from "react";
import type { SavedSearchSettingsDto } from "@bhavano/types";
import { updateSavedSearchSettingsAction } from "@/app/actions/admin";

export function SavedSearchSettingsForm({ initial }: { initial: SavedSearchSettingsDto }) {
  const [freeAlertsPerUser, setFreeAlertsPerUser] = useState(String(initial.freeAlertsPerUser));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const parsed = Number(freeAlertsPerUser);
  const valid = Number.isInteger(parsed) && parsed >= 0 && parsed <= 20;

  async function onSave() {
    setSaving(true);
    setMessage(null);
    const result = await updateSavedSearchSettingsAction({ freeAlertsPerUser: parsed });
    setSaving(false);
    setMessage(result.success ? { type: "success", text: "Alert settings updated." } : { type: "error", text: result.error });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 16, background: "var(--surface)" }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Free quota</div>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 320 }}>
          <span style={{ fontSize: 12.5, color: "var(--muted)" }}>Free alerts per user (lifetime)</span>
          <input
            type="number"
            min={0}
            max={20}
            value={freeAlertsPerUser}
            onChange={(e) => setFreeAlertsPerUser(e.target.value)}
            style={{
              border: "1px solid var(--border)",
              borderRadius: 9,
              padding: "9px 10px",
              fontSize: 13.5,
              background: "var(--surface)",
              color: "var(--text)",
            }}
          />
        </label>
        <p style={{ fontSize: 12, color: "var(--muted)", margin: "12px 0 0", maxWidth: 560 }}>
          Alerts beyond this need Bhavano Plus. Set it to <strong>0</strong> to put alerts back
          behind Plus entirely — but note that the empty-search prompt then can&apos;t promise to
          notify anyone, and its confirmation message changes to say a person will follow up
          instead. Alerts already granted free keep working regardless of what this is changed to.
        </p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={onSave}
          disabled={saving || !valid}
          style={{
            background: "var(--green)",
            color: "var(--on-green)",
            border: "none",
            borderRadius: 8,
            padding: "10px 16px",
            fontSize: 13.5,
            fontWeight: 700,
            cursor: saving || !valid ? "default" : "pointer",
            opacity: saving || !valid ? 0.6 : 1,
          }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {message && (
          <span style={{ fontSize: 13, color: message.type === "success" ? "var(--green)" : "var(--danger)" }}>
            {message.text}
          </span>
        )}
      </div>
    </div>
  );
}
