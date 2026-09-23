"use client";

import { useState } from "react";
import type { PlatformFeeSettings } from "@bhavano/types/platformFeePricing";
import { updatePlatformFeeAction } from "@/app/actions/admin";

export function PlatformFeeSettingsForm({ initial }: { initial: PlatformFeeSettings }) {
  const [propertyListingFee, setPropertyListingFee] = useState(String(initial.propertyListingFee));
  const [coworkingPgStorageListingFee, setCoworkingPgStorageListingFee] = useState(
    String(initial.coworkingPgStorageListingFee),
  );
  const [furnitureInteriorsListingFee, setFurnitureInteriorsListingFee] = useState(
    String(initial.furnitureInteriorsListingFee),
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const parsed: PlatformFeeSettings = {
    propertyListingFee: Number(propertyListingFee || "0"),
    coworkingPgStorageListingFee: Number(coworkingPgStorageListingFee || "0"),
    furnitureInteriorsListingFee: Number(furnitureInteriorsListingFee || "0"),
  };
  const valid = Object.values(parsed).every((n) => Number.isInteger(n) && n >= 0);

  async function onSave() {
    setSaving(true);
    setMessage(null);
    const result = await updatePlatformFeeAction(parsed);
    setSaving(false);
    setMessage(
      result.success ? { type: "success", text: "Platform fee updated." } : { type: "error", text: result.error },
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 16, background: "var(--surface)" }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>House / Apartment / Villa / Plot / Commercial</div>
        <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 12px" }}>
          Mandatory at publish checkout when greater than ₹0. Set to ₹0 to hide the fee for this tier.
        </p>
        <div style={{ display: "flex", gap: 12 }}>
          <Field label="Platform fee (₹)" value={propertyListingFee} onChange={setPropertyListingFee} />
        </div>
      </div>

      <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 16, background: "var(--surface)" }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Coworking / PG / Storage</div>
        <div style={{ display: "flex", gap: 12 }}>
          <Field
            label="Platform fee (₹)"
            value={coworkingPgStorageListingFee}
            onChange={setCoworkingPgStorageListingFee}
          />
        </div>
      </div>

      <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 16, background: "var(--surface)" }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Furniture / Interiors</div>
        <div style={{ display: "flex", gap: 12 }}>
          <Field
            label="Platform fee (₹)"
            value={furnitureInteriorsListingFee}
            onChange={setFurnitureInteriorsListingFee}
          />
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
        {saving ? "Saving…" : "Save platform fee"}
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
        min={0}
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
