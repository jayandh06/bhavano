"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createDiscountCodeAction } from "@/app/actions/discount-codes";

export function CreateDiscountCodeForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [discountPercent, setDiscountPercent] = useState("10");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [maxRedemptionsPerUser, setMaxRedemptionsPerUser] = useState("1");
  const [expiresAt, setExpiresAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCreate() {
    setSaving(true);
    setError(null);
    const result = await createDiscountCodeAction({
      code: code.trim(),
      discountPercent: Number(discountPercent),
      maxRedemptions: maxRedemptions ? Number(maxRedemptions) : undefined,
      maxRedemptionsPerUser: maxRedemptionsPerUser ? Number(maxRedemptionsPerUser) : undefined,
      expiresAt: expiresAt ? new Date(`${expiresAt}T23:59:59`).toISOString() : undefined,
    });
    setSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setCode("");
    setMaxRedemptions("");
    router.refresh();
  }

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 12,
        alignItems: "flex-end",
        marginBottom: 20,
        padding: 16,
        border: "1px solid var(--border)",
        borderRadius: 10,
        background: "var(--surface)",
      }}
    >
      <Field label="Code">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="LAUNCH25"
          style={inputStyle}
        />
      </Field>
      <Field label="Discount %">
        <input
          type="number"
          min={1}
          max={100}
          value={discountPercent}
          onChange={(e) => setDiscountPercent(e.target.value.replace(/[^0-9]/g, ""))}
          style={{ ...inputStyle, width: 90 }}
        />
      </Field>
      <Field label="Max redemptions (total)">
        <input
          type="number"
          min={1}
          value={maxRedemptions}
          onChange={(e) => setMaxRedemptions(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="Unlimited"
          style={{ ...inputStyle, width: 130 }}
        />
      </Field>
      <Field label="Max per user">
        <input
          type="number"
          min={1}
          value={maxRedemptionsPerUser}
          onChange={(e) => setMaxRedemptionsPerUser(e.target.value.replace(/[^0-9]/g, ""))}
          style={{ ...inputStyle, width: 100 }}
        />
      </Field>
      <Field label="Expires">
        <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} style={inputStyle} />
      </Field>
      <button
        onClick={onCreate}
        disabled={saving || !code.trim() || !discountPercent}
        style={{
          background: "var(--green)",
          color: "var(--on-green)",
          border: "none",
          borderRadius: 8,
          padding: "10px 16px",
          fontSize: 13.5,
          fontWeight: 700,
          cursor: "pointer",
          opacity: saving || !code.trim() || !discountPercent ? 0.6 : 1,
        }}
      >
        {saving ? "Creating…" : "Create code"}
      </button>
      {error && <span style={{ fontSize: 12.5, color: "var(--danger)" }}>{error}</span>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 11.5, fontWeight: 700, color: "var(--muted)" }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 9,
  padding: "8px 10px",
  fontSize: 13.5,
  background: "var(--surface)",
  color: "var(--text)",
  minWidth: 120,
};
