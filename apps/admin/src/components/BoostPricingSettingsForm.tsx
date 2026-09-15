"use client";

import { useState } from "react";
import type { BoostPriceSettings } from "@bhavano/types/boostPricing";
import { updateBoostPricingAction } from "@/app/actions/admin";

export function BoostPricingSettingsForm({ initial }: { initial: BoostPriceSettings }) {
  const [propertyBoostPrice7d, setPropertyBoostPrice7d] = useState(String(initial.propertyBoostPrice7d));
  const [propertyBoostPrice15d, setPropertyBoostPrice15d] = useState(String(initial.propertyBoostPrice15d));
  const [coworkingPgStorageBoostPrice7d, setCoworkingPgStorageBoostPrice7d] = useState(
    String(initial.coworkingPgStorageBoostPrice7d),
  );
  const [coworkingPgStorageBoostPrice15d, setCoworkingPgStorageBoostPrice15d] = useState(
    String(initial.coworkingPgStorageBoostPrice15d),
  );
  const [furnitureInteriorsBoostPrice7d, setFurnitureInteriorsBoostPrice7d] = useState(
    String(initial.furnitureInteriorsBoostPrice7d),
  );
  const [furnitureInteriorsBoostPrice15d, setFurnitureInteriorsBoostPrice15d] = useState(
    String(initial.furnitureInteriorsBoostPrice15d),
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const parsed: BoostPriceSettings = {
    propertyBoostPrice7d: Number(propertyBoostPrice7d),
    propertyBoostPrice15d: Number(propertyBoostPrice15d),
    coworkingPgStorageBoostPrice7d: Number(coworkingPgStorageBoostPrice7d),
    coworkingPgStorageBoostPrice15d: Number(coworkingPgStorageBoostPrice15d),
    furnitureInteriorsBoostPrice7d: Number(furnitureInteriorsBoostPrice7d),
    furnitureInteriorsBoostPrice15d: Number(furnitureInteriorsBoostPrice15d),
  };
  const valid = Object.values(parsed).every((n) => Number.isInteger(n) && n > 0);

  async function onSave() {
    setSaving(true);
    setMessage(null);
    const result = await updateBoostPricingAction(parsed);
    setSaving(false);
    setMessage(
      result.success ? { type: "success", text: "Boost prices updated." } : { type: "error", text: result.error },
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 16, background: "var(--surface)" }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>House / Apartment / Villa / Plot / Commercial</div>
        <div style={{ display: "flex", gap: 12 }}>
          <Field label="7-day boost (₹)" value={propertyBoostPrice7d} onChange={setPropertyBoostPrice7d} />
          <Field label="15-day boost (₹)" value={propertyBoostPrice15d} onChange={setPropertyBoostPrice15d} />
        </div>
      </div>

      <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 16, background: "var(--surface)" }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Coworking / PG / Storage</div>
        <div style={{ display: "flex", gap: 12 }}>
          <Field
            label="7-day boost (₹)"
            value={coworkingPgStorageBoostPrice7d}
            onChange={setCoworkingPgStorageBoostPrice7d}
          />
          <Field
            label="15-day boost (₹)"
            value={coworkingPgStorageBoostPrice15d}
            onChange={setCoworkingPgStorageBoostPrice15d}
          />
        </div>
      </div>

      <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 16, background: "var(--surface)" }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Furniture / Interiors</div>
        <div style={{ display: "flex", gap: 12 }}>
          <Field
            label="7-day boost (₹)"
            value={furnitureInteriorsBoostPrice7d}
            onChange={setFurnitureInteriorsBoostPrice7d}
          />
          <Field
            label="15-day boost (₹)"
            value={furnitureInteriorsBoostPrice15d}
            onChange={setFurnitureInteriorsBoostPrice15d}
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
        {saving ? "Saving…" : "Save boost prices"}
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
