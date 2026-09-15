"use client";

import { useState } from "react";
import type { InstantAlertsPriceSettings } from "@bhavano/types/instantAlertsPricing";
import { updateInstantAlertsPricingAction } from "@/app/actions/admin";

export function InstantAlertsPricingSettingsForm({ initial }: { initial: InstantAlertsPriceSettings }) {
  const [instantAlertsPrice, setInstantAlertsPrice] = useState(String(initial.instantAlertsPrice));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const parsed = Number(instantAlertsPrice);
  const valid = Number.isInteger(parsed) && parsed > 0;

  async function onSave() {
    setSaving(true);
    setMessage(null);
    const result = await updateInstantAlertsPricingAction({ instantAlertsPrice: parsed });
    setSaving(false);
    setMessage(
      result.success
        ? { type: "success", text: "Instant Alerts price updated." }
        : { type: "error", text: result.error },
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 16, background: "var(--surface)" }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
          Flat fee — every category, no duration tiers
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <Field label="Instant Alerts price (₹)" value={instantAlertsPrice} onChange={setInstantAlertsPrice} />
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
        {saving ? "Saving…" : "Save Instant Alerts price"}
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
