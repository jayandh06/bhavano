"use client";

import { useState } from "react";
import type { ContactRevealSettingsDto } from "@bhavano/types";
import { updateContactRevealSettingsAction } from "@/app/actions/admin";

export function ContactRevealSettingsForm({ initial }: { initial: ContactRevealSettingsDto }) {
  const [freeRevealsPerUser, setFreeRevealsPerUser] = useState(String(initial.freeRevealsPerUser));
  const [creditPackSize, setCreditPackSize] = useState(String(initial.creditPackSize));
  const [creditPackPriceRupees, setCreditPackPriceRupees] = useState(String(initial.creditPackPriceRupees));
  const [creditExpiryMonths, setCreditExpiryMonths] = useState(String(initial.creditExpiryMonths));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const parsed = {
    freeRevealsPerUser: Number(freeRevealsPerUser),
    creditPackSize: Number(creditPackSize),
    creditPackPriceRupees: Number(creditPackPriceRupees),
    creditExpiryMonths: Number(creditExpiryMonths),
  };
  const valid =
    Number.isInteger(parsed.freeRevealsPerUser) &&
    parsed.freeRevealsPerUser >= 0 &&
    [parsed.creditPackSize, parsed.creditPackPriceRupees, parsed.creditExpiryMonths].every(
      (n) => Number.isInteger(n) && n > 0,
    );

  async function onSave() {
    setSaving(true);
    setMessage(null);
    const result = await updateContactRevealSettingsAction(parsed);
    setSaving(false);
    setMessage(
      result.success ? { type: "success", text: "Contact-reveal settings updated." } : { type: "error", text: result.error },
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 16, background: "var(--surface)" }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Free quota</div>
        <Field label="Free reveals per user (lifetime)" value={freeRevealsPerUser} onChange={setFreeRevealsPerUser} min={0} />
      </div>

      <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 16, background: "var(--surface)" }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Credit pack</div>
        <div style={{ display: "flex", gap: 12 }}>
          <Field label="Credits per pack" value={creditPackSize} onChange={setCreditPackSize} min={1} />
          <Field label="Price (₹)" value={creditPackPriceRupees} onChange={setCreditPackPriceRupees} min={1} />
          <Field label="Expires after (months)" value={creditExpiryMonths} onChange={setCreditExpiryMonths} min={1} />
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

function Field({
  label,
  value,
  onChange,
  min,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min: number;
}) {
  return (
    <div style={{ flex: 1 }}>
      <label style={{ display: "block", fontSize: 11.5, color: "var(--muted)", marginBottom: 6, fontWeight: 700 }}>
        {label}
      </label>
      <input
        type="number"
        min={min}
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
